# September 29 — eelgrass, bull kelp, speech and propulsion

Designer references: six photos in `feedback/9-29/`. Their distinctive features guide procedural geometry; the photographs themselves are retained as references and are not repackaged as textures.

The previous seven-blade upright kelp fans are removed. Eelgrass uses individually rooted narrow ribbons with variable length and width, distributed in broad irregular meadows. Bull kelp uses a long stipe, round float and seven trailing ribbons, with three geometry variants and per-plant proportions. Olive/brown surface colour and depth absorption distinguish it from the green submerged grass.

Habitat depth means depth at chart datum: grass 2–6 m, kelp 4–10 m. Tide changes actual water depth above fixed roots. Moving vegetation to a new depth contour every tide would make its habitat slide around the coast, so plants retain their positions. Stipes have finite lengths; shorter plants submerge first as water rises, while low water exposes more trailing stems/canopies. Current samples set downstream orientation every quarter second; slack water retains the previous direction. Small shader motion supplies ribbon flutter. Neither habitat accesses catch/stock fields or changes simulation geometry.

Current arrow alpha is 0.22, previously 0.4. The fixed chart lattice and assistance rules remain. Frank's bubbles use layer 40 above his layer-38 card, with horizontal viewport clamping and the existing 2.6-second expiry. This permits visible speech even when a top-edge tutorial card leaves no vertical room above it.

Steerable drive yaw had the wrong sign. With the bow at local −Z, starboard helm must send ahead thrust toward port at the stern. The shared outboard/leg/jet renderer now does this. Neutral propulsion already sits aft of the transom; its mount, hull dimensions, simulation steering and controls remain intact. Validation checks the resulting torque direction, not just a stored yaw number.

Automated evidence and independent visual review are recorded in the companion release receipt and review document. Physical controllers and real mobile devices remain unverified in this revision.
