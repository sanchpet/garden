"""Cut Literata's axes to the range the site sets and write the files as WOFF2.

usage: crop_weight.py OUT_DIR FONT...
"""

import os
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# The site sets weights 400-700 and no text smaller than optical size 12, the axis default:
# the optical sizes 7-11 alone are a quarter of each file. Cutting the top of the weight axis
# rescales its deltas, which moves outlines by at most about one unit per 1000 em.
AXES = {"wght": (400, 700), "opsz": (12, 72)}

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for src in sys.argv[2:]:
    font = instancer.instantiateVariableFont(TTFont(src), AXES)
    font.flavor = "woff2"
    font.save(os.path.join(out, os.path.basename(src)))
