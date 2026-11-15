ProptoolConfig = {
    Command = 'proptool',

    -- what a fresh session starts with
    DefaultModel = 'prop_cs_burger_01',
    DefaultBone = 18905, -- SKEL_L_Hand
    DefaultAnim = { dict = 'mp_player_inteat@burger', name = 'mp_player_int_eat_burger', flag = 49 },

    -- side the panel sits on; the ped is framed on the other side
    PanelSide = 'left',

    -- where the ped is kept while the editor is open (open sea, high up), on an invisible platform
    Sky = vector3(-3200.0, -3000.0, 650.0),
    PlatformModel = 'prop_pallet_01a',

    Camera = {
        distance = 3.4,
        minDistance = 0.4,
        maxDistance = 8.0,
        height = -0.05, -- pivot height above the ped's centre (the whole body fits at this distance)
        fov = 40.0,
        lookPerPixel = 0.05, -- degrees per pixel of mouse travel (RMB held); the panel's Look speed scales it
        gameLook = 60.0, -- degrees per full mouse delta when the page has no focus (native gizmo)
        panSpeed = 0.55, -- metres per second (WASD, Space and Ctrl)
        precision = 0.3, -- Shift held: look and move this much slower
        zoomStep = 0.15, -- metres per wheel notch
    },

    -- the solid box around the ped; props and objects inside it still draw
    Backdrop = { minHalf = 3.0, color = '#0A4BD0' },

    TestKey = 'BACK',
}
