"""Erzeugt die Bilder der Rezeptbibliothek von Better Fit.

Ein Bild je Rezept aus `services/api/fit/kitchen/library.js`, alle im selben
Stil (von oben, weiches Fensterlicht, helles Leinen), damit die Küche ruhig
wirkt. Das Bild kommt von pollinations.ai (über `~/.claude/scripts/genimg.py`),
wird ohne Rand und Wasserzeichen zugeschnitten und landet klein in
`packages/core/src/assets/recipes/<slug>.jpg`.

    python scripts/recipe-photos.py            # nur fehlende
    python scripts/recipe-photos.py --force    # alle neu
"""
import os
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'packages', 'core', 'src', 'assets', 'recipes')
GENIMG = os.path.join(os.path.expanduser('~'), '.claude', 'scripts', 'genimg.py')
STYLE = ('overhead food photo, natural soft window light, warm off-white linen tablecloth, '
         'simple white ceramic plate or bowl, no text, no hands, no people, editorial, calm muted colors')

DISHES = {
    'banana-bread': 'sliced banana bread loaf on a wooden board',
    'banana-pancakes': 'small stack of banana pancakes with banana slices',
    'porridge-banana': 'bowl of oat porridge topped with banana slices',
    'quark-berries': 'bowl of creamy quark topped with fresh mixed berries',
    'veggie-omelette': 'vegetable omelette with peppers and spinach on a plate',
    'rice-chicken-broccoli': 'rice with sliced chicken breast and broccoli',
    'spaghetti-bolognese': 'plate of spaghetti with meat bolognese sauce',
    'pasta-tomato': 'plate of penne pasta in red tomato sauce with fresh basil leaves',
    'lentil-curry': 'bowl of red lentil curry with rice',
    'tofu-stirfry': 'tofu and vegetable stir fry in a bowl',
    'salmon-potatoes': 'baked salmon fillet with boiled potatoes and spinach',
    'chickpea-salad': 'bowl of beige chickpeas mixed with diced red tomato, cucumber and parsley',
    'scrambled-eggs-bread': 'scrambled eggs with a slice of wholegrain bread',
    'yogurt-muesli': 'bowl of yogurt with muesli and apple pieces',
    'baked-potato-cottage': 'baked potatoes with cottage cheese and chives',
    'tuna-salad': 'tuna salad with sweet corn and lettuce',
    'protein-shake': 'glass of banana milkshake next to a banana',
    'tofu-scramble': 'tofu scramble with spinach in a pan',
    'soy-shake': 'glass of soy milkshake with a spoon of peanut butter',
    'apple-almonds': 'a red apple cut in wedges next to a small bowl of brown almonds',
}


def crop(src, dst):
    image = Image.open(src).convert('RGB')
    width, height = image.size
    # Rand und das Wasserzeichen unten rechts weg, dann klein.
    image = image.crop((int(width * 0.05), int(height * 0.05), int(width * 0.91), int(height * 0.91)))
    image.resize((480, 480), Image.LANCZOS).save(dst, quality=82, optimize=True, progressive=True)


def main():
    force = '--force' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    raw = os.path.join(OUT, '_raw')
    os.makedirs(raw, exist_ok=True)
    for slug, dish in DISHES.items():
        target = os.path.join(OUT, f'{slug}.jpg')
        if os.path.exists(target) and not force:
            continue
        for attempt in range(3):
            done = subprocess.run(
                [sys.executable, GENIMG, f'{dish}, {STYLE}', '-o', raw, '-n', slug, '-w', '800', '-H', '800'],
                capture_output=True, text=True,
            )
            source = os.path.join(raw, f'{slug}.jpg')
            if done.returncode == 0 and os.path.exists(source):
                crop(source, target)
                print('ok', slug)
                break
            print('retry', slug, attempt, done.stdout.strip()[-120:], done.stderr.strip()[-120:])
        else:
            print('FAILED', slug)
    for name in os.listdir(raw):
        os.remove(os.path.join(raw, name))
    os.rmdir(raw)


if __name__ == '__main__':
    main()
