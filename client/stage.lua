-- Where the ped stands while the editor is open: up in the sky on an invisible platform, frozen, unarmed, with no
-- control. The spot the command was run from is kept and the ped goes back there on exit and for Test mode.
-- Every move keeps the ped's heading, so the camera framing stays the same across the cut (see camera.lua).
local warned = false -- Stage.Guard says once that it had to step in

Stage = {
    origin = nil, -- { coords, weapon, frozen, ragdoll }
    platform = nil,
    home = false, -- the ped is at the origin (test mode)
}

local function waitForGround(ped, timeout)
    local limit = GetGameTimer() + timeout

    while not HasCollisionLoadedAroundEntity(ped) and GetGameTimer() < limit do
        local at = GetEntityCoords(ped)

        RequestCollisionAtCoord(at.x, at.y, at.z)
        Wait(0)
    end

    if not HasCollisionLoadedAroundEntity(ped) then
        Editor.Debug('the ground around the starting spot did not load in time')
    end
end

local function place(ped, x, y, z)
    RequestCollisionAtCoord(x, y, z)
    SetEntityCoordsNoOffset(ped, x, y, z, false, false, false)
end

local function makePlatform(sky)
    local hash = Editor.LoadModel(ProptoolConfig.PlatformModel, 5000)

    if not hash then
        Editor.Debug('the platform model did not load', ProptoolConfig.PlatformModel)
        return nil
    end

    local platform = CreateObject(hash, sky.x, sky.y, sky.z - 1.0, false, false, false)

    SetModelAsNoLongerNeeded(hash)

    if not platform or platform == 0 then
        Editor.Debug('the platform could not be created')
        return nil
    end

    FreezeEntityPosition(platform, true)
    SetEntityVisible(platform, false, false)

    return platform
end

local function holdStill(ped)
    FreezeEntityPosition(ped, true)
    SetPedCanRagdoll(ped, false)
    ClearPedTasksImmediately(ped)
    SetCurrentPedWeapon(ped, joaat('WEAPON_UNARMED'), true)
end

-- First: remember the spot and stop the ped where it stands (the camera is about to swing round it)
function Stage.Capture()
    local ped = PlayerPedId()

    Stage.origin = {
        coords = GetEntityCoords(ped),
        weapon = GetSelectedPedWeapon(ped),
        frozen = IsEntityPositionFrozen(ped),
        ragdoll = CanPedRagdoll(ped),
    }
    Stage.home, warned = false, false

    FreezeEntityPosition(ped, true)
end

-- While the ped is up in the sky the game keeps streaming the world round the starting spot, so the way back
-- (test mode, closing) does not wait for the ground
local function streamStart()
    local origin = Stage.origin

    if origin then
        SetFocusPosAndVel(origin.coords.x, origin.coords.y, origin.coords.z, 0.0, 0.0, 0.0)
    end
end

-- The cut up: the platform first, then the ped on it
function Stage.Enter()
    local ped = PlayerPedId()
    local sky = ProptoolConfig.Sky

    Stage.platform = makePlatform(sky)
    place(ped, sky.x, sky.y, sky.z)
    streamStart()
    holdStill(ped)
    Stage.home = false
end

-- Test mode: the ped goes back to the spot it came from and is free to walk
function Stage.Home()
    local origin = Stage.origin
    local ped = PlayerPedId()

    if not origin then
        Editor.Debug('no starting spot to go back to')
        return
    end

    ClearFocus()
    FreezeEntityPosition(ped, true)
    place(ped, origin.coords.x, origin.coords.y, origin.coords.z)
    waitForGround(ped, 1500)
    FreezeEntityPosition(ped, origin.frozen)
    SetPedCanRagdoll(ped, origin.ragdoll)
    Stage.home = true
end

-- Back to the editor: up in the sky again
function Stage.Sky()
    local ped = PlayerPedId()
    local sky = ProptoolConfig.Sky

    FreezeEntityPosition(ped, true)
    place(ped, sky.x, sky.y, sky.z)
    streamStart()
    holdStill(ped)
    Stage.home = false
end

-- The editor is closing. `fast`: the resource is stopping, do not wait for the ground. `stay`: the ped is already
-- at the starting spot (closed from test mode), only the ped's state goes back.
function Stage.Leave(fast, stay)
    local origin = Stage.origin
    local ped = PlayerPedId()

    if Stage.platform and DoesEntityExist(Stage.platform) then
        DeleteEntity(Stage.platform)
    end

    Stage.platform = nil
    ClearFocus()

    if not origin then return end

    if not stay then
        FreezeEntityPosition(ped, true)
        place(ped, origin.coords.x, origin.coords.y, origin.coords.z)

        if not fast then waitForGround(ped, 1500) end
    end

    FreezeEntityPosition(ped, origin.frozen)
    SetPedCanRagdoll(ped, origin.ragdoll)
    SetCurrentPedWeapon(ped, origin.weapon, true)
    Stage.origin, Stage.home = nil, false
end

-- The ped has to stay where it was put, frozen, whatever another script or a key does (a crouch, an emote cancel on
-- movement, an unfreeze). Runs every frame while the editor holds the ped; says so once if it had to step in.
function Stage.Guard()
    local ped = PlayerPedId()
    local sky = ProptoolConfig.Sky
    local fixed = false

    if GetPedStealthMovement(ped) then
        SetPedStealthMovement(ped, false, 'DEFAULT_ACTION')
    end

    if not IsEntityPositionFrozen(ped) then
        FreezeEntityPosition(ped, true)
        fixed = true
    end

    if #(GetEntityCoords(ped) - vector3(sky.x, sky.y, sky.z)) > 1.5 then
        SetEntityCoordsNoOffset(ped, sky.x, sky.y, sky.z, false, false, false)
        fixed = true
    end

    if fixed and not warned then
        warned = true
        Editor.Debug('something unfroze or moved the ped; it was put back')
    end
end
