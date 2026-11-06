/* Drone Lab shared data: the build steps, what every part does, and the drones themselves.
   Used by the hub (drone-lab.html), the assembly figure (drone-assembly.html) and the simulator (drone-flight.html).
   Geometry is in millimetres (x = nose direction, y = left, z = up); flight numbers are SI units. */

// Real build order. Props go on LAST on every real build (after the motors have been tested without them) and the
// battery is only plugged in to fly, so both come after the shell.
const DL_STEPS = [
  { k:'frame',   name:'Frame',            t:'The frame is the skeleton: carbon-fibre plates that everything bolts to. It has to be stiff, because any flex shows up as vibration in the gyro.' },
  { k:'boom',    name:'Tail boom',        t:'The boom puts the tail rotor a long way behind the main rotor. That long lever is the whole trick: a small sideways push out there swings the entire nose. It also carries the drive shaft aft.' },
  { k:'arms',    name:'Arms',             t:'The arms put the motors far enough apart that the props never touch. Longer arms carry bigger props; on most FPV frames a crashed arm unbolts and is swapped in minutes.' },
  { k:'motors',  name:'Motors',           t:'Brushless motors: a ring of magnets in the spinning bell, coils on the fixed stator. "2207" means a 22 mm wide, 7 mm tall stator. Diagonal motors spin the same way.' },
  { k:'esc',     name:'ESCs',             t:'Electronic speed controllers turn battery DC into three switched phases that spin each motor, thousands of times a second, at whatever speed the flight controller asks for.' },
  { k:'fc',      name:'Flight controller',t:'The brain: a gyro measures rotation thousands of times a second, and the PID loop corrects the motors to make the drone rotate exactly as fast as your sticks ask.' },
  { k:'camera',  name:'Camera & radios',  t:'The camera feeds the video transmitter (VTX) that sends live video to your goggles; the receiver (RX) picks up your radio sticks. Two separate radio links.' },
  { k:'wiring',  name:'Wiring',           t:'Three motor wires per motor to the ESC, a thick battery lead with a capacitor to soak up voltage spikes, and thin signal wires between the boards.' },
  { k:'shell',   name:'Top plate / shell',t:'The top plate or shell closes the frame, stiffens it and protects the electronics. It also carries the battery strap or slot.' },
  { k:'payload', name:'Payload pod',      t:'The pod slung under the belly on two rails. It carries the marker charge for the target range. Hanging it low puts the mass under the frame, which steadies the drone but makes it heavier to accelerate.' },
  { k:'battery', name:'Battery',          t:'A lithium battery: each cell is 4.2 V full and should not go below about 3.5 V under load. It goes on only to fly; weight sits near the centre so the drone balances.' },
  { k:'props',   name:'Propellers',       t:'Props go on last, always. Half spin clockwise and half counter-clockwise so their twisting forces cancel. Red arrow = clockwise from above, blue = counter-clockwise.' },
  { k:'rotor',   name:'Main rotor',       t:'The main rotor is the wing. Two long blades spun fast enough that each one meets air at flying speed: pitch sets how hard they bite (collective), and tilting the whole disc sends that thrust sideways (cyclic). The blades go on last, like props.' },
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
  payload:  ['PAYLOAD POD', 'The pod slung under the belly: it carries the marker charge used on the range. Hanging it low puts the mass under the frame, which steadies the drone but makes it heavier to accelerate.'],
  fin:      ['FIN', 'Small fins on the tail of the pod: they keep it straight in flight and give the pilot something to read the drone\'s attitude from at speed.'],
  skid:     ['SKID', 'Flat rails the craft lands on. Low and wide so it will not tip on uneven ground, and tall enough that the belly sensor never touches down first.'],
  boom:     ['TAIL BOOM', 'Carries the tail rotor far aft. The long lever arm is what lets a small sideways push swing the whole nose, and the drive shaft runs down the inside of it.'],
  mast:     ['MAST', 'The shaft from the transmission up to the rotor head. It carries the entire weight of the aircraft in tension while spinning at hundreds of rpm.'],
  rotor:    ['MAIN ROTOR', 'Two long blades on a powered mast. Collective sets their bite, cyclic tilts the disc; the disc is the wing, so the machine flies where it points.'],
  tailrotor:['TAIL ROTOR', 'Pushes sideways at the end of the boom. Its thrust cancels the torque the main rotor puts into the body, so the pedals can point the nose where you want it.'],
  module:   ['MISSION MODULE', 'The swappable bay on the spine: sensors, radios or a warhead. Tool-free latches let the crew change the job between flights without tools.'],
  bay:      ['PAYLOAD BAY', 'Field-swappable bay on a standard rail under the belly. Slide one out and the next in: camera, radar or a cargo pod.'],
  engine:   ['ENGINE / TRANSMISSION', 'The engine drives the mast through a gearbox that trades speed for torque. Its exhaust and cooling sit under the cowling, right behind the mast.'],
  hatch:    ['HATCH', 'A removable panel. Crews open it to reach the avionics and the battery plugs without tools.'],
};

/* Motor layouts: angle from the nose (deg, + toward the left), and spin seen from above (1 = CW, -1 = CCW).
   Quads use Betaflight's default "props in": front-left and rear-right CW, front-right and rear-left CCW. */
const dlRing = (n, a0) => Array.from({ length:n }, (_, i) => ({ a: a0 + 360*i/n, dir: i % 2 ? -1 : 1 }));
const DL_QUAD = dlRing(4, 45);

/* Shared layout for the strike quad, in millimetres, so the assembly figure and the flight simulator
   draw the same airframe: long splayed legs first (the payload pod needs clear air under the belly),
   then the plates, the stack, the top plate and the battery. */
const DL_STRIKE = g => { const leg = 46, zB = leg + 2.5, zA = zB + 2.5, zA1 = zA + 5, zC = zA1 + 2, zE = zC + 4, zF = zE + 10;
  return { leg, zB, zA, zA1, zC, zE, zF, T0: zC + g.standH, s2: g.stack/2, bw: g.stack/2 + 3,
           pod: { x0: -26, x1: 30, nose: 20, hy: 17, z0: zB - 34, z1: zB - 4 } }; };

const DL_DRONES = [
  { id:'freestyle', name:'5-inch Freestyle', cls:'FPV quad', pal:'tomato', ready:true,
    blurb:'The do-everything FPV quad: flips, rolls and dives, carrying an action camera.',
    facts:[['Wheelbase','225 mm'], ['Props','5.1 in, 3 blades'], ['Battery','6S 1300 mAh'], ['Weight','about 650 g']],
    geo:{ style:'xplate', motors:DL_QUAD, arm:112, armW:14, propR:65, blades:3, motorR:14, motorH:18, plateL:104, plateW:44,
          standH:28, stack:30.5, action:true, batt:[72, 35, 38], cells:'6S', propCol:'#ef6a4c' },
    wt:{frame:38, arms:36, motors:132, esc:14, fc:8, camera:28, wiring:18, shell:30, payload:0, battery:210, props:20},
    fly:{ mass:.65, twr:9, tau:.035, kd:.055, rate:[200, 670, .54], yawRate:[200, 600, .5], modes:['acro', 'angle'], crashV:8,
          uptilt:30, cells:6, mAh:1300, Imax:150, kQ:.016, cam:'fpv' } },

  { id:'cinewhoop', name:'3-inch Cinewhoop', cls:'Ducted FPV', pal:'mint', ready:true,
    blurb:'Ducted props make it safe to fly close to people and indoors for smooth cinematic shots.',
    facts:[['Wheelbase','140 mm'], ['Props','3 in in ducts'], ['Battery','4S 850 mAh'], ['Weight','about 370 g']],
    geo:{ style:'duct', motors:DL_QUAD, arm:70, armW:10, propR:38, blades:3, motorR:9, motorH:12, ductR:41, ductH:24,
          stack:20, batt:[60, 31, 26], cells:'4S', propCol:'#8fd0f0' },
    wt:{frame:45, arms:40, motors:64, esc:7, fc:6, camera:34, wiring:10, shell:16, payload:0, battery:105, props:8},
    fly:{ mass:.37, twr:5, tau:.045, kd:.11, rate:[150, 480, .4], yawRate:[150, 400, .4], modes:['acro', 'angle'], crashV:5.5,
          uptilt:12, cells:4, mAh:850, Imax:60, kQ:.014, cam:'fpv', ducts:true } },

  { id:'mini', name:'Camera Drone (Mini)', cls:'GPS camera drone', pal:'cobalt', ready:true,
    blurb:'A folding sub-250 g camera drone. GPS holds it still when you let go of the sticks.',
    facts:[['Diagonal','247 mm'], ['Props','4 in, 2 blades'], ['Battery','2S 2450 mAh'], ['Weight','249 g']],
    geo:{ style:'shell', motors:DL_QUAD, propR:50, blades:2, motorR:8, cells:'2S', propCol:'#3d3935' },
    wt:{frame:48, arms:22, motors:28, esc:6, fc:12, camera:32, wiring:4, shell:20, payload:0, battery:77, props:4},
    fly:{ mass:.249, twr:2.4, tau:.05, kd:.035, rate:[100, 200, .2], yawRate:[60, 120, .2], modes:['gps', 'sport', 'cine'], crashV:3.2,
          uptilt:-10, cells:2, mAh:2450, Imax:16, kQ:.012, cam:'gimbal' } },

  { id:'octo', name:'Heavy-lift Octocopter', cls:'Cinema / cargo', pal:'mustard', ready:true,
    blurb:'Eight big motors lift a cinema camera. Slow to react, very stable, and it can lose a motor and still land.',
    facts:[['Diagonal','1240 mm'], ['Props','18 in, 2 blades'], ['Battery','2 x 6S 16000 mAh'], ['Weight','about 22 kg']],
    geo:{ style:'round', motors:dlRing(8, 22.5), arm:620, propR:228, blades:2, motorR:44, gearH:300, plateR:165, gimbal:'cine',
          cells:'2x 6S', propCol:'#3d3935' },
    wt:{frame:1900, arms:1600, motors:2800, esc:640, fc:260, camera:4200, wiring:420, shell:380, payload:0, battery:9200, props:560},
    fly:{ mass:22, twr:1.9, tau:.18, kd:.47, rate:[60, 120, .2], yawRate:[40, 80, .2], modes:['gps', 'angle'], crashV:2.5,
          uptilt:-15, cells:6, mAh:32000, Imax:420, kQ:.02, cam:'gimbal' } },

  { id:'race', name:'5-inch Racer', cls:'Race quad', pal:'blush', ready:true,
    blurb:'Stretched-X, low and light: built for straight-line speed through gates rather than tricks.',
    facts:[['Wheelbase','215 mm'], ['Props','5 in, 3 blades'], ['Battery','6S 1100 mAh'], ['Weight','about 520 g']],
    geo:{ style:'xplate', motors:[{a:35,dir:1},{a:145,dir:-1},{a:215,dir:1},{a:325,dir:-1}], arm:108, armW:13, propR:63, blades:3,
          motorR:14, motorH:17, plateL:96, plateW:34, standH:22, stack:30.5, batt:[70, 34, 34], cells:'6S', propCol:'#f3a6bb' },
    wt:{frame:30, arms:30, motors:128, esc:14, fc:8, camera:22, wiring:16, shell:22, payload:0, battery:185, props:18},
    fly:{ mass:.52, twr:11, tau:.03, kd:.045, rate:[230, 800, .5], yawRate:[200, 600, .5], modes:['acro', 'angle'], crashV:7,
          uptilt:40, cells:6, mAh:1100, Imax:160, kQ:.016, cam:'fpv' } },

  { id:'longrange', name:'7-inch Long Range', cls:'Long-range FPV', pal:'mint', ready:true,
    blurb:'Big slow props and a Li-ion pack: 20+ minute flights and kilometres of range, with GPS rescue.',
    facts:[['Wheelbase','315 mm'], ['Props','7 in, 2 blades'], ['Battery','6S 4000 mAh Li-ion'], ['Weight','about 1050 g']],
    geo:{ style:'xplate', motors:DL_QUAD, arm:158, armW:16, propR:89, blades:2, motorR:17, motorH:20, plateL:120, plateW:48,
          standH:30, stack:30.5, gps:true, batt:[72, 44, 42], cells:'6S Li-ion', propCol:'#93d3b0' },
    wt:{frame:60, arms:64, motors:200, esc:16, fc:9, camera:38, wiring:22, shell:40, payload:0, battery:560, props:24},
    fly:{ mass:1.05, twr:4.5, tau:.06, kd:.05, rate:[160, 500, .4], yawRate:[150, 400, .4], modes:['acro', 'angle'], crashV:7,
          uptilt:20, cells:6, mAh:4000, Imax:70, kQ:.017, cam:'fpv' } },

  { id:'whoop', name:'Racing Tiny Whoop', cls:'65 mm indoor', pal:'blush', ready:true,
    blurb:'A 28 g palm-sized whoop. Bounces off walls, flies in your living room, teaches acro cheaply.',
    facts:[['Wheelbase','65 mm'], ['Props','31 mm, 4 blades'], ['Battery','1S 300 mAh'], ['Weight','28 g']],
    geo:{ style:'duct', whoop:true, motors:DL_QUAD, arm:23, armW:4, propR:15.5, blades:4, motorR:3.6, motorH:8, ductR:17, ductH:12,
          stack:0, batt:[34, 12, 7], cells:'1S', propCol:'#f4b829' },
    wt:{frame:4.2, arms:0, motors:7.6, esc:0, fc:3.4, camera:3.2, wiring:0.6, shell:1.2, payload:0, battery:7.2, props:0.8},
    fly:{ mass:.028, twr:3.4, tau:.02, kd:.006, rate:[180, 720, .5], yawRate:[180, 600, .5], modes:['acro', 'angle'], crashV:9,
          uptilt:15, cells:1, mAh:300, Imax:7, kQ:.012, cam:'fpv', ducts:true } },

  { id:'attack', name:'Attack Quad', cls:'Strike / target quad', pal:'tomato', ready:true,
    blurb:'A tall-legged quad with a payload pod slung under the belly: fly it to the range target and put the charge on the bullseye.',
    facts:[['Wheelbase','264 mm'], ['Props','6 in, 3 blades'], ['Battery','4S 4500 mAh'], ['Weight','about 1.15 kg']],
    geo:{ style:'strike', motors:DL_QUAD, arm:132, armW:16, propR:76, blades:3, motorR:16, motorH:19, plateL:110, plateW:62,
          standH:30, stack:30.5, batt:[96, 46, 34], cells:'4S', propCol:'#e2483d' },
    wt:{frame:105, arms:70, motors:240, esc:18, fc:14, camera:40, wiring:25, shell:110, payload:190, battery:290, props:45},
    fly:{ mass:1.15, twr:5.2, tau:.05, kd:.06, rate:[190, 620, .5], yawRate:[170, 520, .45], modes:['acro', 'angle'], crashV:7.5,
          uptilt:25, cells:4, mAh:4500, Imax:90, kQ:.017, cam:'fpv' } },

  { id:'hexa', name:'Mapping Hexacopter', cls:'Survey / inspection', pal:'cobalt', ready:true,
    blurb:'Six motors and GPS: flies survey grids by itself, carrying a downward mapping camera.',
    facts:[['Diagonal','960 mm'], ['Props','15 in, 2 blades'], ['Battery','6S 10000 mAh'], ['Weight','about 7 kg']],
    geo:{ style:'round', motors:dlRing(6, 30), arm:480, propR:190, blades:2, motorR:34, gearH:230, plateR:130, gimbal:'map',
          cells:'6S', propCol:'#3d3935' },
    wt:{frame:900, arms:600, motors:960, esc:300, fc:180, camera:650, wiring:220, shell:260, payload:0, battery:2600, props:260},
    fly:{ mass:7, twr:2.1, tau:.12, kd:.2, rate:[70, 140, .2], yawRate:[45, 90, .2], modes:['gps', 'angle'], crashV:2.8,
          uptilt:-30, cells:6, mAh:10000, Imax:180, kQ:.019, cam:'gimbal' } },

  { id:'wing', name:'FPV Flying Wing', cls:'Fixed wing', pal:'mustard', ready:false,
    blurb:'No tail, one pusher prop and two elevons. Flies an hour on a small battery, but needs forward speed to stay up.',
    facts:[['Span','1100 mm'], ['Prop','7 in pusher'], ['Battery','4S 2200 mAh'], ['Weight','about 900 g']] },

  { id:'vtol', name:'Quadplane VTOL', cls:'Hybrid VTOL', pal:'tomato', ready:false,
    blurb:'Takes off straight up on four lift motors, then a pusher prop and wing take over for efficient cruise.',
    facts:[['Span','1600 mm'], ['Lift','4 x 12 in'], ['Battery','6S 8000 mAh'], ['Weight','about 4.5 kg']] },

  { id:'bolt', name:'Anduril Bolt', cls:'Modular quad AAV', pal:'mustard', ready:true,
    blurb:'A black faceted quad with four folding arms and a mission module on its spine. It packs into a small case, launches from a clearing and loiters 45 minutes on a gimbal. The M variant swaps the sensor for a warhead and comes down from any angle, including straight from above.',
    facts:[['Range','+20 km'], ['Endurance','+45 min'], ['Weight','12 lb (5.4 kg)'], ['Battery swap','under 10 s']],
    geo:{ style:'bolt', motors:DL_QUAD, arm:350, armW:26, propR:228, blades:2, motorR:26, motorH:34, plateL:560, plateW:150,
          batt:[200, 90, 60], cells:'6S', propCol:'#2a2826', plateR:150, gearH:10 },
    wt:{frame:750, arms:550, motors:420, esc:80, fc:55, camera:320, wiring:100, shell:350, payload:700, battery:1850, props:165},
    // its own words for the shared steps: nothing here is a belly pod on a range
    stepText:{ payload:'The mission module on the spine: sensors, radios or a warhead, latched on without tools. It sits over the centre of mass, so swapping it changes the handling very little.' },
    fly:{ mass:5.4, twr:2.2, tau:.09, kd:.35, rate:[70, 150, .2], yawRate:[55, 120, .2], modes:['gps', 'sport', 'cine'], crashV:3,
          uptilt:-5, cells:6, mAh:24000, Imax:86, kQ:.02, cam:'gimbal' } },

  // one mast, one tail rotor. 'arm' and the geo.plate* values are only read by the flight simulator's generic
  // fallback; the hub station is pinned at the centre with geo.pos so the drawing puts the rotor on the mast.
  { id:'ghost', name:'Anduril Ghost-X', cls:'Autonomous helicopter', pal:'cobalt', ready:true,
    blurb:'Not a quad: one mast, two blades and a tail rotor. It folds into a case the size of a rifle, then hovers and stares for 80 minutes with 25 lb of sensors on a rail under the belly.',
    facts:[['Endurance','80 min'], ['Range','25 km (15.5 mi)'], ['Payload','25 lb (11 kg)'], ['Weight','55 lb (25 kg)']],
    geo:{ style:'heli', motors:[{a:0, dir:1, noProp:true, arrowR:330, thrustR:430}], pos:[[0, 0]], arm:900, rotorR:1900, blades:2, propR:1900, motorR:110, motorH:80,
          tailR:260, tailBlades:2, batt:[400, 240, 120], cells:'6S', propCol:'#2a2826', bellCol:'#332f2a', plateR:420, gearH:100 },
    wt:{frame:4000, boom:800, motors:2400, esc:280, fc:200, camera:1770, wiring:300, shell:2000, payload:2600, battery:9700, rotor:850},
    stepText:{ motors:'The engine and the gearbox, not four brushless cans: the engine spins fast, the gearbox trades that speed for torque, and the mast carries all 25 kg in tension.',
               payload:'The payload bay under the belly on a standard rail: a camera, a radar or a cargo pod. A crew slides one out and the next in, and the aircraft re-trims itself.' },
    // the hub at the top of the mast is a rotor head, not a motor can: it carries the pitch links that fly the blades
    partText:{ motor:['ROTOR HEAD', 'The top of the mast: blade grips, dampers and the pitch links that twist each blade as it goes round. That once-per-revolution twist is the cyclic.'] },
    fly:{ mass:25, twr:1.75, tau:.12, kd:.5, rate:[55, 110, .2], yawRate:[60, 120, .3], modes:['gps', 'sport', 'angle'], crashV:2.5,
          uptilt:-8, cells:6, mAh:106000, Imax:165, kQ:.02, cam:'gimbal', mix:'heli' } },
];
const dlDrone = id => DL_DRONES.find(d => d.id === id) || DL_DRONES[0];
