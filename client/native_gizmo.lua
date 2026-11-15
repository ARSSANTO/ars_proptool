-- The game's own gizmo (the DrawGizmo native plus the built-in gizmo commands) on one entity.
-- NativeGizmo.Run(entity) blocks until the player is done and says how it ended:
--   'save' (Enter), 'cancel' (Esc), 'switch' (F11, hand over to the UI gizmo). The caller reads the entity again.
-- Keys: LMB drags an arrow, R swaps move / rotate, Q swaps world / local, hold RMB to look, WASD moves the view.
NativeGizmo = { active = false }

local DRAW_GIZMO = 0xEB2EDCA2
local NAME = 'PropEditorGizmo'

local CONTROL = {
    attack = 24, aim = 25, attack2 = 257,
    lookBehind = 19, moveUp = 32, moveDown = 33, moveLeft = 34, moveRight = 35,
    cover = 44, reload = 45, detonate = 47, sprint = 21, jump = 22, duck = 36,
    moveLR = 30, moveUD = 31, enterVehicle = 23, selectWeapon = 37,
    confirm = 191, back = 177, pause = 200, cancel = 202,
    melee = { 140, 141, 142, 143, 263, 264 },
}

local session = { rotate = false, relative = false, selecting = false, switch = false }

local function normalize(x, y, z)
    local length = math.sqrt(x * x + y * y + z * z)

    if length == 0 then return 0.0, 0.0, 0.0 end

    return x / length, y / length, z / length
end

-- the entity's matrix as 16 floats: right, forward, up, position (what the native reads and writes)
local function matrixBlob(entity)
    local forward, right, up, at = GetEntityMatrix(entity)
    local values = {
        right.x, right.y, right.z, 0.0,
        forward.x, forward.y, forward.z, 0.0,
        up.x, up.y, up.z, 0.0,
        at.x, at.y, at.z, 1.0,
    }
    local blob = string.blob(64)

    for i, value in ipairs(values) do
        blob = blob:blob_pack(1 + (i - 1) * 4, '<f', value)
    end

    return blob
end

local function readFloat(blob, index)
    return (blob:blob_unpack(1 + index * 4, '<f'))
end

local function applyBlob(entity, blob)
    local fx, fy, fz = normalize(readFloat(blob, 4), readFloat(blob, 5), readFloat(blob, 6))
    local rx, ry, rz = normalize(readFloat(blob, 0), readFloat(blob, 1), readFloat(blob, 2))
    local ux, uy, uz = normalize(readFloat(blob, 8), readFloat(blob, 9), readFloat(blob, 10))

    SetEntityMatrix(entity, fx, fy, fz, rx, ry, rz, ux, uy, uz, readFloat(blob, 12), readFloat(blob, 13), readFloat(blob, 14))
end

local function disableControls()
    for _, control in ipairs({
        CONTROL.attack, CONTROL.aim, CONTROL.attack2, CONTROL.lookBehind, CONTROL.moveUp, CONTROL.moveDown,
        CONTROL.moveLeft, CONTROL.moveRight, CONTROL.cover, CONTROL.reload, CONTROL.detonate,
        CONTROL.sprint, CONTROL.jump, CONTROL.duck,
        CONTROL.moveLR, CONTROL.moveUD, CONTROL.enterVehicle, CONTROL.selectWeapon,
        CONTROL.confirm, CONTROL.back, CONTROL.pause, CONTROL.cancel,
    }) do
        DisableControlAction(0, control, true)
    end

    for _, control in ipairs(CONTROL.melee) do
        DisableControlAction(0, control, true)
    end

    DisablePlayerFiring(PlayerId(), true)
end

local function released(control)
    return IsDisabledControlJustReleased(0, control) or IsControlJustReleased(0, control)
end

local function setSelect(on)
    if on == session.selecting then return end

    ExecuteCommand(on and '+gizmoSelect' or '-gizmoSelect')
    session.selecting = on
end

function NativeGizmo.Run(entity)
    session = { rotate = false, relative = false, selecting = false, switch = false }
    NativeGizmo.active = true

    EnterCursorMode()
    ExecuteCommand('+gizmoTranslation')
    SetEntityDrawOutline(entity, true)

    local outcome = 'cancel'

    while DoesEntityExist(entity) do
        Wait(0)
        disableControls()

        if released(CONTROL.confirm) then
            outcome = 'save'
            break
        end

        if session.switch then
            outcome = 'switch'
            break
        end

        if released(CONTROL.pause) or released(CONTROL.cancel) then
            outcome = 'cancel'
            break
        end

        local blob = matrixBlob(entity)
        local changed = Citizen.InvokeNative(DRAW_GIZMO, blob, NAME, Citizen.ReturnResultAnyway())

        if changed then applyBlob(entity, blob) end
    end

    setSelect(false)
    ExecuteCommand('-gizmoTranslation')
    ExecuteCommand('-gizmoRotation')
    ExecuteCommand('-gizmoLocal')
    LeaveCursorMode()

    if DoesEntityExist(entity) then SetEntityDrawOutline(entity, false) end

    NativeGizmo.active = false

    return outcome
end

-- Keys. They only act while the native gizmo is open.
Editor.AddKeybind({
    name = 'gizmo_select',
    description = 'Prop editor gizmo: drag',
    defaultMapper = 'MOUSE_BUTTON',
    defaultKey = 'MOUSE_LEFT',
    onPressed = function()
        if NativeGizmo.active then setSelect(true) end
    end,
    onReleased = function()
        if NativeGizmo.active then setSelect(false) end
    end,
})

Editor.AddKeybind({
    name = 'gizmo_rotate',
    description = 'Prop editor gizmo: move / rotate',
    defaultKey = 'R',
    onPressed = function()
        if not NativeGizmo.active then return end

        session.rotate = not session.rotate
        ExecuteCommand(session.rotate and '-gizmoTranslation' or '-gizmoRotation')
        ExecuteCommand(session.rotate and '+gizmoRotation' or '+gizmoTranslation')
    end,
})

Editor.AddKeybind({
    name = 'gizmo_space',
    description = 'Prop editor gizmo: world / local',
    defaultKey = 'Q',
    onPressed = function()
        if not NativeGizmo.active then return end

        session.relative = not session.relative
        ExecuteCommand(session.relative and '+gizmoLocal' or '-gizmoLocal')
    end,
})

Editor.AddKeybind({
    name = 'gizmo_switch',
    description = 'Prop editor gizmo: switch to the UI gizmo',
    defaultKey = 'F11',
    onPressed = function()
        if NativeGizmo.active then session.switch = true end
    end,
})
