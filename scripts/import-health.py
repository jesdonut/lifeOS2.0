#!/usr/bin/env python3
"""
Parse Apple Health export.xml → _local/period-seed.json
Usage: python3 scripts/import-health.py [path/to/export.xml]
Default path: export.xml in project root
"""
import xml.etree.ElementTree as ET
import json
import sys
from datetime import datetime
from pathlib import Path

FLOW_MAP = {
    'HKCategoryValueVaginalBleedingUnspecified': 'unspecified',
    'HKCategoryValueVaginalBleedingLight': 'light',
    'HKCategoryValueVaginalBleedingMedium': 'medium',
    'HKCategoryValueVaginalBleedingHeavy': 'heavy',
    'HKCategoryValueVaginalBleedingNone': 'none',
}

def parse_dt(s):
    return datetime.strptime(s[:19], '%Y-%m-%d %H:%M:%S')

def date_str(dt):
    return dt.strftime('%Y-%m-%d')

def parse_xml(path):
    tree = ET.parse(path)
    root = tree.getroot()

    flow_days = {}   # date → flow level
    bbt_days = {}    # date → (time, temp) — keep earliest time per day
    spotting_days = set()

    for record in root.iter('Record'):
        rtype = record.get('type', '')
        start_raw = record.get('startDate', '')
        if not start_raw:
            continue
        try:
            dt = parse_dt(start_raw)
        except ValueError:
            continue
        d = date_str(dt)

        if rtype == 'HKCategoryTypeIdentifierMenstrualFlow':
            val = record.get('value', '')
            flow = FLOW_MAP.get(val, 'unspecified')
            if flow == 'none':
                continue
            existing = flow_days.get(d)
            # prefer more specific over unspecified if same day logged twice
            if existing is None or existing == 'unspecified':
                flow_days[d] = flow

        elif rtype == 'HKQuantityTypeIdentifierBasalBodyTemperature':
            try:
                temp = float(record.get('value', ''))
                existing = bbt_days.get(d)
                # keep earliest reading (morning temp is most accurate)
                if existing is None or dt.time() < existing[0]:
                    bbt_days[d] = (dt.time(), round(temp, 2))
            except (ValueError, TypeError):
                pass

        elif rtype == 'HKCategoryTypeIdentifierIntermenstrualBleeding':
            spotting_days.add(d)

    bbt_final = {d: t for d, (_, t) in bbt_days.items()}
    return flow_days, bbt_final, spotting_days

def group_entries(flow_days, bbt_days):
    if not flow_days:
        return []

    sorted_dates = sorted(flow_days)
    groups = [[sorted_dates[0]]]

    for date in sorted_dates[1:]:
        prev = datetime.strptime(groups[-1][-1], '%Y-%m-%d')
        curr = datetime.strptime(date, '%Y-%m-%d')
        if (curr - prev).days <= 1:
            groups[-1].append(date)
        else:
            groups.append([date])

    entries = []
    for days in groups:
        start = days[0]
        entry_bbt = {d: bbt_days[d] for d in days if d in bbt_days}
        entries.append({
            'id': 'p_' + start.replace('-', '_'),
            'start': start,
            'end': days[-1],
            'flow': {d: flow_days[d] for d in days},
            'symptoms': {},
            'bbt': entry_bbt,
            'discharge': {},
            'notes': '',
        })

    return entries

def main():
    xml_path = sys.argv[1] if len(sys.argv) > 1 else 'export.xml'

    if not Path(xml_path).exists():
        print(f'Error: {xml_path} not found')
        print('Pass path as argument: python3 scripts/import-health.py path/to/export.xml')
        sys.exit(1)

    print(f'Parsing {xml_path}...')
    flow_days, bbt_days, spotting_days = parse_xml(xml_path)
    print(f'  {len(flow_days)} flow days · {len(bbt_days)} BBT readings · {len(spotting_days)} spotting days')

    entries = group_entries(flow_days, bbt_days)
    print(f'  Grouped into {len(entries)} period entries')

    out = {
        'version': 2,
        'period': {
            'entries': entries,
            'spotting': sorted(spotting_days),
            'settings': {
                'cycleMin': 26,
                'cycleMax': 32,
                'periodLengthTypical': 5,
            },
        },
    }

    out_path = Path('_local/period-seed.json')
    out_path.parent.mkdir(exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f'  → {out_path}')

if __name__ == '__main__':
    main()
