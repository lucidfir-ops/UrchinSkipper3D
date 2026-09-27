#!/usr/bin/env python3
"""Read-only controller routing diagnostic. Does not read keyboard events or change Steam settings."""
import os
import array
import fcntl
from pathlib import Path

print('URCHIN SKIPPER — CONTROLLER ROUTING')
print('Steam launch context:', 'yes' if os.environ.get('SteamAppId') or os.environ.get('SteamGameId') else 'not present')
print('Desktop session:', os.environ.get('XDG_SESSION_TYPE', 'unknown'))
print('Input devices exposed by the kernel:')
source=Path('/proc/bus/input/devices')
if source.exists():
    for block in source.read_text().split('\n\n'):
        if any(term in block.lower() for term in ['valve','x-box','xbox','gamepad','controller']):
            for line in block.splitlines():
                if line.startswith(('N: Name=', 'H: Handlers=')): print(' ',line)
for path in Path('/sys/class/input').glob('js*/device/name'):
    device=Path('/dev/input')/path.parts[-3]
    print('Joystick:', path.read_text().strip(), '·',str(device), '· readable:',os.access(device,os.R_OK))
    if os.access(device,os.R_OK):
        try:
            fd=os.open(device,os.O_RDONLY|os.O_NONBLOCK)
            try:
                axes=array.array('B',[0]);buttons=array.array('B',[0]);axis_map=array.array('B',[0]*64)
                fcntl.ioctl(fd,0x80016a11,axes,True);fcntl.ioctl(fd,0x80016a12,buttons,True);fcntl.ioctl(fd,0x80406a32,axis_map,True)
                print('  Capability:',axes[0],'axes,',buttons[0],'buttons; Linux axis codes',list(axis_map[:axes[0]]))
            finally: os.close(fd)
        except OSError as error: print('  Capability query:',error)
print('Browser check: F4 / View opens raw gamepads, axes, buttons, keyboard events and focus status.')
print('In Desktop Mode keep Steam running and launch the game shortcut from Steam’s library with a Gamepad layout.')
print('Direct Desktop launcher also works; a Desktop keyboard/mouse layout will not expose analogue gamepad axes.')
print('No driver, Steam setting, input binding or process was changed.')
