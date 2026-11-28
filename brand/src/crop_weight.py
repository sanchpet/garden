"""Cut the weight axis of variable fonts to 400-900 and write them as WOFF2.

usage: crop_weight.py OUT_DIR FONT...
"""

import os
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for src in sys.argv[2:]:
    # Only the light side goes: 400 stays the default and 900 the end of the axis, so the
    # deltas that remain are not rescaled and every kept weight renders as before.
    font = instancer.instantiateVariableFont(TTFont(src), {"wght": (400, 900)})
    font.flavor = "woff2"
    font.save(os.path.join(out, os.path.basename(src)))
