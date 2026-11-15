-- Moving a prop with a gizmo. There are two, both inside this resource:
--   UI gizmo     : the editor page draws the arrows (three.js) and sends the new world pose; the panel stays usable.
--   Native gizmo : the game's own gizmo (native_gizmo.lua) on the prop taken off the ped for the duration.
-- Either way the world pose is turned into offsets from the bone and the prop is attached again. Esc puts the
-- prop back where it was when the session began.
Gizmo = {
    active = false,
    native = false, -- the native gizmo is running (the page is not focused)
    propId = nil,
    frame = nil, -- the bone's frame (Props.BoneFrame) and the game frame it was read in
    frameAt = nil,
    start = nil, -- { pos, rot } when the session began
    heldAnim = false, -- we paused the animation for the session, so we resume it
}

local function activeProp()
    return Gizmo.propId and Editor.props[Gizmo.propId] or nil
end

local function hold()
    if Anim.IsPlaying() and not Anim.paused then
        Anim.SetPaused(true)
        Gizmo.heldAnim = true
        Wait(150) -- the pose has to settle before the bone's frame is read
    end
end

local function release()
    if Gizmo.heldAnim and Anim.IsLoaded() then
        Anim.SetPaused(false)
    end

    Gizmo.heldAnim = false
end

-- The bone moves with the animation, so its frame is read again in every new game frame
local function boneFrame(prop)
    local now = GetFrameCount()

    if Gizmo.frameAt ~= now or not Gizmo.frame then
        Gizmo.frame = Props.BoneFrame(prop)
        Gizmo.frameAt = now
    end

    return Gizmo.frame
end

local function begin(id)
    local prop = Editor.props[id]

    if not prop or not prop.handle or not DoesEntityExist(prop.handle) then
        Editor.Debug('gizmo refused, unknown prop', tostring(id))
        return false
    end

    if Gizmo.active or Editor.testing then
        Editor.Debug('gizmo refused, one is already open or the editor is in test mode')
        return false
    end

    Gizmo.active, Gizmo.propId = true, id
    hold()

    Gizmo.frame, Gizmo.frameAt = nil, nil
    Gizmo.start = {
        pos = { x = prop.pos.x, y = prop.pos.y, z = prop.pos.z },
        rot = { x = prop.rot.x, y = prop.rot.y, z = prop.rot.z },
    }

    return prop
end

local function finish(save)
    local prop = activeProp()
    local id = Gizmo.propId

    if prop and not save and Gizmo.start then
        Props.Set(prop.id, { pos = Gizmo.start.pos, rot = Gizmo.start.rot })
    end

    release()

    Gizmo.active, Gizmo.native, Gizmo.propId, Gizmo.frame, Gizmo.frameAt, Gizmo.start = false, false, nil, nil, nil, nil

    if prop then
        Editor.Send('gizmo:close', { id = id, saved = save == true, pos = prop.pos, rot = prop.rot })
    else
        Editor.Send('gizmo:close', { id = id, saved = false })
    end
end

local function sendOpen(prop)
    local pose = Props.WorldPose(prop)

    Editor.Send('gizmo:open', {
        id = prop.id,
        handle = prop.handle,
        position = pose.position,
        rotation = pose.rotation,
        fov = ProptoolConfig.Camera.fov,
    })
end

-- The UI gizmo asks for the prop's pose every frame (while the mouse is not on an arrow the page follows it)
function Gizmo.Stream()
    local prop = activeProp()

    if not prop or Gizmo.native then return end

    if not prop.handle or not DoesEntityExist(prop.handle) then
        Editor.Debug('gizmo closed, the prop is gone')
        finish(false)
        return
    end

    local position, rotation = Camera.View()

    Editor.Send('gizmo:frame', {
        camera = { position = position, rotation = rotation },
        entity = Props.WorldPose(prop),
    })
end

function Gizmo.StartUi(id)
    local prop = begin(id)

    if not prop then return false end

    sendOpen(prop)

    return true
end

-- world pose from the page -> bone offsets -> attach
function Gizmo.Move(data)
    local prop = activeProp()

    if not prop or Gizmo.native or type(data) ~= 'table' then
        Editor.Debug('gizmo move ignored, no UI gizmo session')
        return false
    end

    local position, rotation = Editor.ReadVec(data.position), Editor.ReadVec(data.rotation)

    if not position or not rotation then
        Editor.Debug('gizmo move ignored, bad numbers')
        return false
    end

    local pos, rot = Props.WorldToLocal(boneFrame(prop), prop, position, rotation)
    local ok = Props.Set(prop.id, { pos = pos, rot = rot })

    if ok then
        Editor.Send('prop:transform', { id = prop.id, pos = prop.pos, rot = prop.rot })
    end

    return ok
end

function Gizmo.Save()
    if not Gizmo.active then return false end

    finish(true)

    return true
end

function Gizmo.Cancel()
    if not Gizmo.active or Gizmo.native then return false end

    finish(false)

    return true
end

-- The game's gizmo on the same prop (from the button, or F11 inside the UI gizmo)
function Gizmo.StartNative(id)
    if Gizmo.native then
        Editor.Debug('native gizmo refused, it is already running')
        return false
    end

    local prop = Gizmo.active and activeProp() or begin(id)

    if not prop then return false end

    Gizmo.native = true
    Editor.Send('gizmo:native', { on = true })
    Camera.ReleaseInput()
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)

    CreateThread(function()
        -- the pose is fixed while the prop is off the ped, so the bone's frame is read before it leaves
        Gizmo.frame, Gizmo.frameAt = Props.BoneFrame(prop), GetFrameCount()

        local pose = Props.WorldPose(prop)

        DetachEntity(prop.handle, false, false)
        SetEntityCoordsNoOffset(prop.handle, pose.position.x, pose.position.y, pose.position.z, false, false, false)
        SetEntityRotation(prop.handle, pose.rotation.x, pose.rotation.y, pose.rotation.z, 2, true)
        FreezeEntityPosition(prop.handle, true)

        local outcome = NativeGizmo.Run(prop.handle)

        Editor.BlockPause(500)

        if DoesEntityExist(prop.handle) then
            FreezeEntityPosition(prop.handle, false)

            if outcome ~= 'cancel' then
                local after = Props.WorldPose(prop)
                local pos, rot = Props.WorldToLocal(Gizmo.frame, prop, after.position, after.rotation)

                Props.Set(prop.id, { pos = pos, rot = rot })
            else
                Props.Set(prop.id, { pos = prop.pos, rot = prop.rot })
            end
        else
            Editor.Debug('the prop was lost during the native gizmo')
        end

        Gizmo.native = false
        Editor.Send('gizmo:native', { on = false })
        Editor.Send('prop:transform', { id = prop.id, pos = prop.pos, rot = prop.rot })

        if Editor.active then
            SetNuiFocus(true, true)
            SetNuiFocusKeepInput(false)
        end

        if outcome == 'switch' and Editor.active and DoesEntityExist(prop.handle) then
            sendOpen(prop) -- the session goes on in the UI gizmo
        else
            finish(outcome == 'save')
        end
    end)

    return true
end

function Gizmo.Abort()
    if Gizmo.active and not Gizmo.native then
        finish(false)
    end
end
