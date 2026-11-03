/* Drone Lab shared data: the build steps, what every part does, and the drones themselves.
   Used by the hub (drone-lab.html), the assembly figure (drone-assembly.html) and the simulator (drone-flight.html).
   Geometry is in millimetres (x = nose direction, y = left, z = up); flight numbers are SI units. */

// Real build order. Props go on LAST on every real build (after the motors have been tested without them) and the
// battery is only plugged in to fly, so both come after the shell.
const DL_STEPS = [
  { k:'frame',   name:'Frame',            t:'The frame is the skeleton: carbon-fibre plates that everything bolts to. It has to be stiff, because any flex shows up as vibration in the gyro.' },
  { k:'arms',    name:'Arms',             t:'The arms put the motors far enough apart that the props never touch. Longer arms carry bigger props; on most FPV frames a crashed arm unbolts and is swapped in minutes.' },
  { k:'motors',  name:'Motors',           t:'Brushless motors: a ring of magnets in the spinning bell, coils on the fixed stator. "2207" means a 22 mm wide, 7 mm tall stator. Diagonal motors spin the same way.' },
  { k:'esc',     name:'ESCs',             t:'Electronic speed controllers turn battery DC into three switched phases that spin each motor, thousands of times a second, at whatever speed the flight controller asks for.' },
  { k:'fc',      name:'Flight controller',t:'The brain: a gyro measures rotation thousands of times a second, and the PID loop corrects the motors to make the drone rotate exactly as fast as your sticks ask.' },
  { k:'camera',  name:'Camera & radios',  t:'The camera feeds the video transmitter (VTX) that sends live video to your goggles; the receiver (RX) picks up your radio sticks. Two separate radio links.' },
  { k:'wiring',  name:'Wiring',           t:'Three motor wires per motor to the ESC, a thick battery lead with a capacitor to soak up voltage spikes, and thin signal wires between the boards.' },
  { k:'shell',   name:'Top plate / shell',t:'The top plate or shell closes the frame, stiffens it and protects the electronics. It also carries the battery strap or slot.' },
  { k:'battery', name:'Battery',          t:'A lithium battery: each cell is 4.2 V full and should not go below about 3.5 V under load. It goes on only to fly; weight sits near the centre so the drone balances.' },
  { k:'props',   name:'Propellers',       t:'Props go on last, always. Half spin clockwise and half counter-clockwise so their twisting forces cancel. Red arrow = clockwise from above, blue = counter-clockwise.' },
];

// what each kind of part does (shown when a part is clicked, and as its tooltip)
const DL_PARTS = {
  plate:    ['FRAME PLATE', 'Carbon-fibre plate. Carbon is light and very stiff; the stack and arms bolt to it.'],
  arm:      ['ARM', 'Holds a motor out from the centre. The distance between diagonal motors is the "wheelbase".'],
  duct:     ['DUCT', 'A ring around the prop. It protects people and things and adds a little thrust at low speed, at the cost of drag at high speed.'],
  standoff: ['STANDOFF', 'Aluminium posts that hold the top plate above the bottom plate and make a box around the electronics.'],
  foot:     ['FOOT', 'Rubber or legs the drone stands on, so the bottom plate and camera never hit the ground first.'],
  gear:     ['LANDING GEAR', 'Tall legs keep the big camera clear of the ground on take-off and landing.'],
  motor:    ['MOTOR', 'Brushless outrunner. Its speed (KV x volts) and the prop size set how much thrust it makes. It spins whichever way the ESC drives it.'],
  esc:      ['ESC', 'Electronic speed controller: switches battery power through the motor coils in sequence. Changing two motor wires (or a setting) reverses the motor.'],
  fc:       ['FLIGHT CONTROLLER', 'Reads the gyro about 8000 times a second and runs the PID loop: it works out how hard each motor must push to match the rotation your sticks ask for.'],
  gyro:     ['GYRO (IMU)', 'Measures rotation speed on three axes. In acro mode this is the only sensor the drone uses: it holds whatever angle you leave it at.'],
  rx:       ['RECEIVER', 'Picks up your radio transmitter. Throttle, yaw, pitch and roll arrive as numbers the flight controller turns into rotation rates.'],
  vtx:      ['VIDEO TX', 'Sends the camera picture to your goggles in real time (5.8 GHz). Never power it without an antenna fitted.'],
  antenna:  ['ANTENNA', 'Antennas stick out the back, away from the carbon frame, which blocks radio signals.'],
  camera:   ['FPV CAMERA', 'Wide-angle, very low-latency camera you fly through. It is tilted up because the drone leans forward to fly forward.'],
  action:   ['ACTION CAMERA', 'Records the smooth high-quality footage; the FPV camera is only for flying.'],
  gimbal:   ['GIMBAL', 'Three small motors hold the camera level whatever the drone does, so the footage stays smooth while the drone tilts.'],
  gps:      ['GPS', 'Lets the drone know where it is, so it can hold position, fly home and land by itself.'],
  shell:    ['SHELL', 'Moulded body: keeps rain and dust off the electronics and stiffens the frame.'],
  canopy:   ['CANOPY', 'Soft TPU cover over the electronics: bends in a crash instead of breaking.'],
  battery:  ['BATTERY', 'LiPo or Li-ion pack. Cells in series (S) raise the voltage; capacity (mAh) sets flight time. Voltage sags under hard throttle.'],
  strap:    ['BATTERY STRAP', 'Holds the battery. A loose battery shifts the balance mid-flight.'],
  xt60:     ['BATTERY LEAD', 'Thick silicone wires and an XT60/XT90 connector carry up to 150 A.'],
  cap:      ['CAPACITOR', 'Soaks up voltage spikes from the motors that could reset or damage the electronics.'],
  wire:     ['MOTOR WIRES', 'Three phase wires per motor. Any order works; swapping two reverses the motor.'],
  pdb:      ['POWER BOARD', 'Power distribution board: splits battery power to every ESC.'],
  prop:     ['PROPELLER', 'Twisted blades push air down. A CW prop and a CCW prop are mirror images: fit the wrong one and it pushes air up.'],
  wing:     ['WING', 'Generates lift from forward speed, like a plane, so it flies far on little power.'],
};

/* Motor layouts: angle from the nose (deg, + toward the left), and spin seen from above (1 = CW, -1 = CCW).
   Quads use Betaflight's default "props in": front-left and rear-right CW, front-right and rear-left CCW. */
const dlRing = (n, a0) => Array.from({ length:n }, (_, i) => ({ a: a0 + 360*i/n, dir: i % 2 ? -1 : 1 }));
const DL_QUAD = dlRing(4, 45);

const DL_DRONES = [
  { id:'freestyle', name:'5-inch Freestyle', cls:'FPV quad', pal:'tomato', ready:true,
    blurb:'The do-everything FPV quad: flips, rolls and dives, carrying an action camera.',
    facts:[['Wheelbase','225 mm'], ['Props','5.1 in, 3 blades'], ['Battery','6S 1300 mAh'], ['Weight','about 650 g']],
    geo:{ style:'xplate', motors:DL_QUAD, arm:112, armW:14, propR:65, blades:3, motorR:14, motorH:18, plateL:104, plateW:44,
          standH:28, stack:30.5, action:true, batt:[72, 35, 38], cells:'6S', propCol:'#ef6a4c' },
    wt:[38, 36, 132, 14, 8, 28, 18, 30, 210, 20],
    fly:{ mass:.65, twr:9, tau:.035, kd:.055, rate:[200, 670, .54], yawRate:[200, 600, .5], modes:['acro', 'angle'], crashV:8,
          uptilt:30, cells:6, mAh:1300, Imax:150, kQ:.016, cam:'fpv' } },

  { id:'cinewhoop', name:'3-inch Cinewhoop', cls:'Ducted FPV', pal:'mint', ready:true,
    blurb:'Ducted props make it safe to fly close to people and indoors for smooth cinematic shots.',
    facts:[['Wheelbase','140 mm'], ['Props','3 in in ducts'], ['Battery','4S 850 mAh'], ['Weight','about 370 g']],
    geo:{ style:'duct', motors:DL_QUAD, arm:70, armW:10, propR:38, blades:3, motorR:9, motorH:12, ductR:41, ductH:24,
          stack:20, batt:[60, 31, 26], cells:'4S', propCol:'#8fd0f0' },
    wt:[45, 40, 64, 7, 6, 34, 10, 16, 105, 8],
    fly:{ mass:.37, twr:5, tau:.045, kd:.11, rate:[150, 480, .4], yawRate:[150, 400, .4], modes:['acro', 'angle'], crashV:5.5,
          uptilt:12, cells:4, mAh:850, Imax:60, kQ:.014, cam:'fpv', ducts:true } },

  { id:'mini', name:'Camera Drone (Mini)', cls:'GPS camera drone', pal:'cobalt', ready:true,
    blurb:'A folding sub-250 g camera drone. GPS holds it still when you let go of the sticks.',
    facts:[['Diagonal','247 mm'], ['Props','4 in, 2 blades'], ['Battery','2S 2450 mAh'], ['Weight','249 g']],
    geo:{ style:'shell', motors:DL_QUAD, propR:50, blades:2, motorR:8, cells:'2S', propCol:'#3d3935' },
    wt:[48, 22, 28, 6, 12, 32, 4, 20, 77, 4],
    fly:{ mass:.249, twr:2.4, tau:.05, kd:.035, rate:[100, 200, .2], yawRate:[60, 120, .2], modes:['gps', 'sport', 'cine'], crashV:3.2,
          uptilt:-10, cells:2, mAh:2450, Imax:16, kQ:.012, cam:'gimbal' } },

  { id:'octo', name:'Heavy-lift Octocopter', cls:'Cinema / cargo', pal:'mustard', ready:true,
    blurb:'Eight big motors lift a cinema camera. Slow to react, very stable, and it can lose a motor and still land.',
    facts:[['Diagonal','1240 mm'], ['Props','18 in, 2 blades'], ['Battery','2 x 6S 16000 mAh'], ['Weight','about 22 kg']],
    geo:{ style:'round', motors:dlRing(8, 22.5), arm:620, propR:228, blades:2, motorR:44, gearH:300, plateR:165, gimbal:'cine',
          cells:'2x 6S', propCol:'#3d3935' },
    wt:[1900, 1600, 2800, 640, 260, 4200, 420, 380, 9200, 560],
    fly:{ mass:22, twr:1.9, tau:.18, kd:.47, rate:[60, 120, .2], yawRate:[40, 80, .2], modes:['gps', 'angle'], crashV:2.5,
          uptilt:-15, cells:6, mAh:32000, Imax:420, kQ:.02, cam:'gimbal' } },

  { id:'race', name:'5-inch Racer', cls:'Race quad', pal:'blush', ready:true,
    blurb:'Stretched-X, low and light: built for straight-line speed through gates rather than tricks.',
    facts:[['Wheelbase','215 mm'], ['Props','5 in, 3 blades'], ['Battery','6S 1100 mAh'], ['Weight','about 520 g']],
    geo:{ style:'xplate', motors:[{a:35,dir:1},{a:145,dir:-1},{a:215,dir:1},{a:325,dir:-1}], arm:108, armW:13, propR:63, blades:3,
          motorR:14, motorH:17, plateL:96, plateW:34, standH:22, stack:30.5, batt:[70, 34, 34], cells:'6S', propCol:'#f3a6bb' },
    wt:[30, 30, 128, 14, 8, 22, 16, 22, 185, 18],
    fly:{ mass:.52, twr:11, tau:.03, kd:.045, rate:[230, 800, .5], yawRate:[200, 600, .5], modes:['acro', 'angle'], crashV:7,
          uptilt:40, cells:6, mAh:1100, Imax:160, kQ:.016, cam:'fpv' } },

  { id:'longrange', name:'7-inch Long Range', cls:'Long-range FPV', pal:'mint', ready:true,
    blurb:'Big slow props and a Li-ion pack: 20+ minute flights and kilometres of range, with GPS rescue.',
    facts:[['Wheelbase','315 mm'], ['Props','7 in, 2 blades'], ['Battery','6S 4000 mAh Li-ion'], ['Weight','about 1050 g']],
    geo:{ style:'xplate', motors:DL_QUAD, arm:158, armW:16, propR:89, blades:2, motorR:17, motorH:20, plateL:120, plateW:48,
          standH:30, stack:30.5, gps:true, batt:[72, 44, 42], cells:'6S Li-ion', propCol:'#93d3b0' },
    wt:[60, 64, 200, 16, 9, 38, 22, 40, 560, 24],
    fly:{ mass:1.05, twr:4.5, tau:.06, kd:.05, rate:[160, 500, .4], yawRate:[150, 400, .4], modes:['acro', 'angle'], crashV:7,
          uptilt:20, cells:6, mAh:4000, Imax:70, kQ:.017, cam:'fpv' } },

  { id:'whoop', name:'Racing Tiny Whoop', cls:'65 mm indoor', pal:'blush', ready:true,
    blurb:'A 28 g palm-sized whoop. Bounces off walls, flies in your living room, teaches acro cheaply.',
    facts:[['Wheelbase','65 mm'], ['Props','31 mm, 4 blades'], ['Battery','1S 300 mAh'], ['Weight','28 g']],
    geo:{ style:'duct', whoop:true, motors:DL_QUAD, arm:23, armW:4, propR:15.5, blades:4, motorR:3.6, motorH:8, ductR:17, ductH:12,
          stack:0, batt:[34, 12, 7], cells:'1S', propCol:'#f4b829' },
    wt:[4.2, 0, 7.6, 0, 3.4, 3.2, .6, 1.2, 7.2, .8],
    fly:{ mass:.028, twr:3.4, tau:.02, kd:.006, rate:[180, 720, .5], yawRate:[180, 600, .5], modes:['acro', 'angle'], crashV:9,
          uptilt:15, cells:1, mAh:300, Imax:7, kQ:.012, cam:'fpv', ducts:true } },

  { id:'hexa', name:'Mapping Hexacopter', cls:'Survey / inspection', pal:'cobalt', ready:true,
    blurb:'Six motors and GPS: flies survey grids by itself, carrying a downward mapping camera.',
    facts:[['Diagonal','960 mm'], ['Props','15 in, 2 blades'], ['Battery','6S 10000 mAh'], ['Weight','about 7 kg']],
    geo:{ style:'round', motors:dlRing(6, 30), arm:480, propR:190, blades:2, motorR:34, gearH:230, plateR:130, gimbal:'map',
          cells:'6S', propCol:'#3d3935' },
    wt:[900, 600, 960, 300, 180, 650, 220, 260, 2600, 260],
    fly:{ mass:7, twr:2.1, tau:.12, kd:.2, rate:[70, 140, .2], yawRate:[45, 90, .2], modes:['gps', 'angle'], crashV:2.8,
          uptilt:-30, cells:6, mAh:10000, Imax:180, kQ:.019, cam:'gimbal' } },

  { id:'wing', name:'FPV Flying Wing', cls:'Fixed wing', pal:'mustard', ready:false,
    blurb:'No tail, one pusher prop and two elevons. Flies an hour on a small battery, but needs forward speed to stay up.',
    facts:[['Span','1100 mm'], ['Prop','7 in pusher'], ['Battery','4S 2200 mAh'], ['Weight','about 900 g']] },

  { id:'vtol', name:'Quadplane VTOL', cls:'Hybrid VTOL', pal:'tomato', ready:false,
    blurb:'Takes off straight up on four lift motors, then a pusher prop and wing take over for efficient cruise.',
    facts:[['Span','1600 mm'], ['Lift','4 x 12 in'], ['Battery','6S 8000 mAh'], ['Weight','about 4.5 kg']] },
];
const dlDrone = id => DL_DRONES.find(d => d.id === id) || DL_DRONES[0];
