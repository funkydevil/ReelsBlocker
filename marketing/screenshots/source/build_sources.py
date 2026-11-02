#!/usr/bin/env python3
"""Build the two active 1440×900 App Store screenshots.

Editorial captions and intentional line breaks live in copy.en.json. Product UI
labels come from localization/catalog.json. The retained filenames 02 and 04
identify the chosen concepts; the visible pagination is 1/2 and 2/2.
"""
from pathlib import Path
from html import escape
import argparse
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--copy', type=Path, default=HERE / 'copy.en.json')
args = parser.parse_args()
COPY = json.loads(args.copy.read_text())
LOCALE = COPY['locale']
UI = json.loads((ROOT / 'localization/catalog.json').read_text())[LOCALE]
INK = '#29243e'; MUTED = '#655e72'; ACCENT = '#6044ad'; LINE = '#d7cfe3'
ICON = '../../icon/ShortVideoBlocker-icon.png'


def txt(x, y, value, size=24, weight=400, fill=INK, key=None, anchor='start', leading=None):
    lines = value if isinstance(value, list) else str(value).split('\n')
    leading = leading or size * 1.24
    tag = f' data-copy-key="{escape(key)}"' if key else ''
    body = ''.join(f'<tspan x="{x}" y="{y + i * leading:g}">{escape(str(line))}</tspan>' for i, line in enumerate(lines))
    return f'<text{tag} text-anchor="{anchor}" font-size="{size}" font-weight="{weight}" fill="{fill}">{body}</text>'


def rect(x, y, w, h, r=0, fill='white', stroke=None, extra=''):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"' + (f' stroke="{stroke}"' if stroke else '') + f' {extra}/>'


def icon(x, y, size):
    return f'<image href="{ICON}" x="{x}" y="{y}" width="{size}" height="{size}"/>'


def check(x, y, size=18, color=ACCENT):
    return f'<path d="M{x} {y+size*.5:g} l{size*.35:g} {size*.35:g} l{size*.65:g} -{size*.78:g}" fill="none" stroke="{color}" stroke-width="{size*.14:g}" stroke-linecap="round" stroke-linejoin="round"/>'


def toggle(x, y):
    return rect(x, y, 36, 22, 11, ACCENT) + f'<circle cx="{x+25}" cy="{y+11}" r="8" fill="white"/>'


def ui_icon(kind, x, y):
    paths = {
      'video': '<rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3Z"/>',
      'image': '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m4 18 5-5 3 3 3-4 5 6"/>',
      'shorts': '<rect x="6" y="5" width="12" height="14" rx="3"/><path d="M9 2h6M9 22h6m-4-13 4 3-4 3Z"/>'
    }
    return f'<g transform="translate({x} {y})" fill="none" stroke="{ACCENT}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">{paths[kind]}</g>'


def footer(n, dark):
    active, inactive, label = ('#c9ffde', '#a088cc', '#e1d6f2') if dark else (ACCENT, '#adc8b5', '#e1d6f2')
    return ''.join(rect(80+i*50, 844, 38, 5, 2.5, active if i==n-1 else inactive) for i in range(2)) + txt(1360, 850, f'{n} / 2', 16, 500, label, anchor='end')


def shell(n, title, content, dark=False):
    brand_ink, brand_muted = ('#ffffff', '#e1d6f2') if dark else (INK, MUTED)
    background = (rect(0,0,1440,900,fill='url(#violetCanvas)')
      + '<ellipse cx="1125" cy="450" rx="365" ry="380" fill="url(#mintGlow)"/>'
      + '<ellipse cx="1136" cy="452" rx="294" ry="320" fill="none" stroke="#c9ffde" stroke-opacity=".18" stroke-width="2"/>') if dark else (
      rect(0,0,1440,900,fill='url(#mintCanvas)')
      + '<ellipse cx="1260" cy="590" rx="420" ry="465" fill="url(#violetStage)"/>'
      + '<ellipse cx="1260" cy="590" rx="364" ry="407" fill="none" stroke="#dac5ff" stroke-opacity=".22" stroke-width="2"/>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900" role="img" aria-labelledby="frame-title frame-description">
<title id="frame-title">{escape(title)}</title>
<desc id="frame-description">Short Video Blocker for Safari. Frame {n} of two. Product UI reconstructed from the current repository. Editorial framing and shadows are not app controls. Setup requires the user to enable the extension and allow website access.</desc>
<defs>
  <linearGradient id="violetCanvas" x1="0" y1=".1" x2="1" y2=".85"><stop stop-color="#24113f"/><stop offset=".5" stop-color="#492179"/><stop offset="1" stop-color="#8250e5"/></linearGradient>
  <radialGradient id="mintGlow"><stop stop-color="#c9ffde" stop-opacity=".45"/><stop offset=".72" stop-color="#b9ffd6" stop-opacity=".17"/><stop offset="1" stop-color="#b9ffd6" stop-opacity="0"/></radialGradient>
  <linearGradient id="mintCanvas" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e9ffed"/><stop offset=".5" stop-color="#d5f3df"/><stop offset="1" stop-color="#b6e5cf"/></linearGradient>
  <linearGradient id="violetStage" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8550e9"/><stop offset=".55" stop-color="#6431be"/><stop offset="1" stop-color="#44206e"/></linearGradient>
  <linearGradient id="card" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#e2eee4"/><stop offset=".5" stop-color="#faf8f4"/><stop offset="1" stop-color="#e6ddfa"/></linearGradient>
  <linearGradient id="button" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#6044ad"/><stop offset="1" stop-color="#7750ba"/></linearGradient>
  <filter id="shadow" x="-40%" y="-35%" width="180%" height="190%"><feDropShadow dx="0" dy="22" stdDeviation="16" flood-color="#19072d" flood-opacity=".24"/><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#19072d" flood-opacity=".12"/></filter>
</defs>
<g font-family="Arial, Helvetica, sans-serif">
{background}
<g id="brand">{icon(76,47,54)}{txt(145,82,COPY['appName'],24,700,brand_ink,key='appName')}{txt(1360,80,COPY['platform'],14,600,brand_muted,key='platform',anchor='end')}</g>
{content}
{footer(n,dark)}
</g></svg>'''


def window_chrome(step):
    return (rect(0,0,300,300,20,'url(#card)',extra='filter="url(#shadow)"')
      + rect(133,9,34,3,1.5,'#c0b6ca')
      + '<circle cx="276" cy="20" r="12" fill="#e3dced"/><path d="m272 16 8 8m0-8-8 8" stroke="#655e72" stroke-width="1.2" stroke-linecap="round"/>'
      + txt(150,37,UI['appName'],8,700,MUTED,anchor='middle')
      + txt(246,38,f'{step} / 4',11,400,MUTED,anchor='end')
      + txt(18,38,UI['back'],11,400,MUTED))


def settings_onboarding():
    sliders = '<g transform="translate(126 58)">' + rect(0,0,48,48,16,'#e6ddfa',LINE)
    for y,x in [(14,17),(24,30),(34,17)]:
        sliders += f'<path d="M12 {y}h24" stroke="{ACCENT}" stroke-width="2" stroke-linecap="round"/><circle cx="{x}" cy="{y}" r="3" fill="#faf8f4" stroke="{ACCENT}" stroke-width="2"/>'
    return (window_chrome(2) + sliders + '</g>'
      + txt(150,137,UI['titleSettings'],20,700,anchor='middle',leading=23.4)
      + txt(150,189,UI['settingsBody'],12,400,MUTED,anchor='middle',leading=17)
      + rect(18,246,264,40,12,'url(#button)') + txt(150,272,UI['openSettings'],12,650,'white',anchor='middle'))


def checkbox_onboarding():
    return (window_chrome(3)
      + txt(150,76,UI['titleEnable'],19,700,anchor='middle',leading=22.2)
      + txt(150,120,['In Safari extensions, find', UI['appName'] + '.'],12,400,MUTED,anchor='middle',leading=17)
      + rect(18,150,264,58,13,'#ffffffb8',LINE)
      + rect(31,167,24,24,6,ACCENT) + check(36,173,14,'white')
      + icon(65,165,28) + txt(104,176,['Short Video','Blocker'],12,650,leading=15)
      + '<circle cx="43" cy="179" r="19" fill="none" stroke="#6044ad" stroke-width="1" opacity=".3"/>'
      + '<path d="M44 180v21l5.6-5.5 4.9 10.5 4.5-2.2-4.9-10.1H62Z" fill="#29243e" stroke="#faf8f4" stroke-width="1.5" stroke-linejoin="round"/>'
      + txt(18,226,UI['checkInstruction'],11,400,MUTED)
      + txt(278,226,UI['pauseDemo'],11,650,ACCENT,anchor='end')
      + rect(18,246,264,40,12,'url(#button)') + txt(150,272,UI['confirmEnabled'],12,650,'white',anchor='middle'))


def settings_row(y, title, detail, kind, height=76):
    return (rect(18,y,284,height,15,'#ffffffb8',LINE)
      + ui_icon(kind,32,y+height/2-12)
      + txt(68,y+29,title,13,650)
      + txt(68,y+49,detail,12,400,MUTED,leading=16.8)
      + toggle(252,y+height/2-11))


def popup():
    return (rect(0,0,320,482,22,'url(#card)',extra='filter="url(#shadow)"')
      + icon(18,18,32) + txt(59,40,UI['appName'],15,700)
      + txt(18,91,UI['popupTitle'],22,700)
      + txt(18,116,UI['popupSubtitle'],12,400,MUTED)
      + txt(18,153,UI['blockLegend'],11,650,MUTED)
      + settings_row(167,UI['facebookVideos'],['Including Reels and live','streams'],'video',80)
      + settings_row(255,UI['facebookImages'],UI['facebookImagesDetail'],'image')
      + settings_row(339,UI['youtubeShorts'],['Regular videos stay','available'],'shorts')
      + rect(18,429,2,34,0,LINE)
      + txt(30,442,UI['settingsReady'],11,400,MUTED)
      + txt(302,442,UI['settingsButton'],11,650,ACCENT,key='ui.settingsButton',anchor='end'))


# Selected concept 02 is screenshot 1 of 2: independent control of three filters.
c=COPY['02']
chips=''
for x,w,label in [(80,184,UI['facebookVideos']),(276,184,UI['facebookImages']),(472,164,UI['youtubeShorts'])]:
    chips += rect(x,635,w,44,22,'#ffffff12','#ffffff33') + txt(x+w/2,663,label,16,500,'#f4edff',anchor='middle')
content=(txt(80,286,c['headline'][0],94,700,'#ffffff',key='02.headline.0')
  +txt(80,391,c['headline'][1],94,700,'#c9ffde',key='02.headline.1')
  +txt(84,497,c['body'],28,400,'#e1d6f2',key='02.body',leading=42)
  +chips+txt(84,747,c['note'],23,500,'#c9ffde',key='02.note',leading=32)
  +'<g transform="translate(840 147) rotate(5) scale(1.38)">' + rect(0,0,320,482,22,'#bda4f2',extra='fill-opacity=".42"')+'</g>'
  +'<g id="popup-ui" transform="translate(805 130) rotate(2) scale(1.38)">'+popup()+'</g>')
(HERE/f'02-your-choice.{LOCALE}.svg').write_text(shell(1,'Your feed. Your rules.',content,dark=True))

# Selected concept 04 is screenshot 2 of 2: the real guided setup, steps 2 and 3.
c=COPY['04']
steps='<path d="M104 509V691" fill="none" stroke="#9dc8af" stroke-width="3"/>'
for i,(y,title_key,body_key) in enumerate([(505,'stepOneTitle','stepOneBody'),(598,'stepTwoTitle','stepTwoBody'),(691,'stepThreeTitle','stepThreeBody')]):
    steps+=f'<circle cx="104" cy="{y}" r="23" fill="{ACCENT}"/>'
    steps+=txt(104,y+7,str(i+1),19,700,'#e3ffed',anchor='middle')
    steps+=txt(148,y+3,c[title_key],24,700,key='04.'+title_key)
    steps+=txt(148,y+34,c[body_key],21,400,'#466453',key='04.'+body_key)
content=(txt(80,242,c['headline'][0],76,700,INK,key='04.headline.0')
  +txt(80,332,c['headline'][1],72,700,ACCENT,key='04.headline.1')
  +steps
  +'<g id="settings-onboarding-ui" transform="translate(790 155) rotate(-6) scale(1.02)">'+settings_onboarding()+'</g>'
  +'<g id="checkbox-onboarding-ui" transform="translate(856 337) scale(1.5)">'+checkbox_onboarding()+'</g>')
(HERE/f'04-easy-setup.{LOCALE}.svg').write_text(shell(2,'We’ll guide you. One step at a time.',content))
print(f'Built the two active {LOCALE} SVG frames in {HERE}')
