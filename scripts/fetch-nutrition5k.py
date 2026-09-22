"""Lädt die Fotos von oben aus Nutrition5k (Google Research, CC BY 4.0).

Je Teller nur `realsense_overhead/<dish>/rgb.png` — keine Tiefenbilder, keine
Videos —, verkleinert auf 512 px als JPEG nach
`services/api/data/fit-reference/nutrition5k/images/<dish>.jpg`. Die Liste der
Teller kommt aus `dish_ids/splits/rgb_*_ids.txt` (vorher mit den Metadaten laden).

    python scripts/fetch-nutrition5k.py            # nur fehlende
    python scripts/fetch-nutrition5k.py --limit 50 # zum Ausprobieren

Quelle: https://github.com/google-research-datasets/Nutrition5k
"""
import io
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, 'services', 'api', 'data', 'fit-reference', 'nutrition5k')
OUT = os.path.join(BASE, 'images')
URL = 'https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset/imagery/realsense_overhead/{}/rgb.png'
SIZE = 512


def ids():
    result = []
    for name in ('rgb_train_ids.txt', 'rgb_test_ids.txt'):
        with open(os.path.join(BASE, 'dish_ids', 'splits', name), encoding='utf-8') as file:
            result += [line.strip() for line in file if line.strip()]
    return result


def fetch(dish):
    target = os.path.join(OUT, f'{dish}.jpg')
    if os.path.exists(target):
        return 'skip'
    for _ in range(3):
        try:
            with urllib.request.urlopen(URL.format(dish), timeout=60) as response:
                data = response.read()
            image = Image.open(io.BytesIO(data)).convert('RGB')
            image.thumbnail((SIZE, SIZE), Image.LANCZOS)
            image.save(target, quality=84, optimize=True)
            return 'ok'
        except Exception as error:  # noqa: BLE001 — erneut versuchen, dann melden
            last = error
    return f'fail {type(last).__name__}'


def main():
    os.makedirs(OUT, exist_ok=True)
    todo = ids()
    if '--limit' in sys.argv:
        todo = todo[: int(sys.argv[sys.argv.index('--limit') + 1])]
    counts = {}
    with ThreadPoolExecutor(max_workers=16) as pool:
        for index, status in enumerate(pool.map(fetch, todo), 1):
            key = status.split(' ')[0]
            counts[key] = counts.get(key, 0) + 1
            if index % 250 == 0:
                print(index, counts, flush=True)
    print('done', counts)


if __name__ == '__main__':
    main()
