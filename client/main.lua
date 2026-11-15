-- Session lifecycle, the per-frame loop and every callback the editor page can call.
local cfg = ProptoolConfig
local bonePick = nil -- { ids = { ... } } while the page is picking a bone in the world
local testHeldAnim = false
local leavingTest = false

local function reply(cb, ok, reason, extra)
    local result = extra or {}

    result.ok = ok
    result.error = reason

    cb(result)
end

local function stateForPage(selected)
    return {
        props = Props.List(),
        selected = selected,
        anim = Anim.Describe(),
        scene = Scene.Describe(),
        nativeGizmo = Editor.nativeGizmo == true,
    }
end

-- ---------------------------------------------------------------------------------------------
-- Close: every way out ends up here. Getting in and out is a plain cut: no camera moves, no fades.
-- ---------------------------------------------------------------------------------------------
local function close(reason, fast)
    if not Editor.active then return end

    local wasTesting = Editor.testing

    Editor.active = false
    bonePick = nil

    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    Editor.BlockPause(600) -- Esc is the editor's key; the pause menu must not take the same press
    Editor.testing, Editor.typing = false, false
    Editor.Send('close', {})

    if Gizmo.active and not Gizmo.native then Gizmo.Abort() end

    Gizmo.active, Gizmo.native = false, false
    Camera.ReleaseInput()
    Anim.Stop()
    Props.Clear()
    Scene.Restore()
    Camera.Stop()
    Stage.Leave(fast, wasTesting)

    if reason then Editor.Notify(reason, 'inform') end
end

-- ---------------------------------------------------------------------------------------------
-- Test mode: walk around with the props on
-- ---------------------------------------------------------------------------------------------
local function startTest()
    if Editor.testing or Gizmo.active then
        Editor.Debug('test refused, a gizmo is open or test mode is already on')
        return false
    end

    Editor.testing = true
    bonePick = nil

    testHeldAnim = Anim.paused
    if testHeldAnim then Anim.SetPaused(false) end

    Camera.ReleaseInput()
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    Editor.BlockPause(400)
    Editor.Send('mode', { test = true })

    -- the ped goes back to where the command was run and is free to walk
    Camera.Pause()
    Stage.Home()

    return true
end

local function stopTest()
    if not Editor.testing or leavingTest then return end

    leavingTest = true

    CreateThread(function()
        Stage.Sky()
        Camera.Update(0.0, false)
        Camera.Resume()
        SetNuiFocus(true, true)
        SetNuiFocusKeepInput(false)

        -- the teleport and the walking ended the clip: start it again where it was
        if Anim.IsLoaded() then
            local held = testHeldAnim

            Anim.Play(Anim.dict, Anim.name, Anim.flag)
            if held then Anim.SetPaused(true) end
        end

        testHeldAnim = false
        leavingTest = false
        Editor.testing = false
        Editor.Send('mode', { test = false })
    end)
end

Editor.AddKeybind({
    name = 'back',
    description = 'Prop editor: back to the editor',
    defaultKey = cfg.TestKey,
    onPressed = stopTest,
})

-- ---------------------------------------------------------------------------------------------
-- The frame loop
-- ---------------------------------------------------------------------------------------------
local function boneDots()
    local ped = PlayerPedId()
    local points = {}

    for _, id in ipairs(bonePick.ids) do
        local index = GetPedBoneIndex(ped, id)

        if index ~= -1 then
            local at = GetWorldPositionOfEntityBone(ped, index)
            local onScreen, x, y = GetScreenCoordFromWorldCoord(at.x, at.y, at.z)

            if onScreen then
                points[#points + 1] = { id = id, x = x, y = y }
            end
        end
    end

    Editor.Send('bones:frame', { points = points })
end

local function loop()
    local last = GetGameTimer()
    local animSent, boneSent = 0, 0

    while Editor.active do
        local now = GetGameTimer()
        local dt = (now - last) / 1000.0

        last = now

        if IsEntityDead(PlayerPedId()) then
            Editor.Debug('closing, the ped died')
            close('The editor closed, you died')
            break
        end

        if Editor.testing then
            Scene.Tick()
        else
            if not Gizmo.native then DisableAllControlActions(0) end

            Stage.Guard()
            Camera.Update(dt, Gizmo.native)
            Scene.Draw()
            Scene.Tick()
            Gizmo.Stream()

            if bonePick and now - boneSent >= 33 then
                boneSent = now
                boneDots()
            end

            if now - animSent >= 100 then
                animSent = now
                Editor.Send('anim:state', Anim.State())
            end
        end

        Wait(0)
    end
end

-- ---------------------------------------------------------------------------------------------
-- Open
-- ---------------------------------------------------------------------------------------------
local function open(model)
    if Editor.active then return end

    local ped = PlayerPedId()

    if IsEntityDead(ped) or IsPedInAnyVehicle(ped, false) or IsPedRagdoll(ped) then
        Editor.Debug('open refused, the ped is dead, in a vehicle or ragdolling')
        Editor.Notify('Stand on your feet first')
        return
    end

    if not Editor.pageReady then
        Editor.Debug('open refused, the editor page has not answered yet')
        Editor.Notify('The editor page is still loading, try again in a moment')
        return
    end

    Editor.active = true

    Stage.Capture()
    Stage.Enter()
    Scene.Reset()
    Camera.Start()

    local id, err = Props.Add({
        model = type(model) == 'string' and model or cfg.DefaultModel,
        bone = cfg.DefaultBone,
    })

    if not id and type(model) == 'string' then
        Editor.Notify(('%s, starting with the default prop'):format(err or 'Prop refused'))
        id = Props.Add({ model = cfg.DefaultModel, bone = cfg.DefaultBone })
    end

    local anim = cfg.DefaultAnim
    local ok, why = Anim.Play(anim.dict, anim.name, anim.flag)

    if not ok then Editor.Debug('default animation did not start', why) end

    SetNuiFocus(true, true)
    SetNuiFocusKeepInput(false) -- the page sends the camera input, so no key reaches the game
    Editor.Send('open', stateForPage(id))

    CreateThread(loop)
end

RegisterNetEvent('ars_proptool:client:Open', function(model, nativeGizmo)
    Editor.nativeGizmo = nativeGizmo == true

    CreateThread(function() open(model) end)
end)

-- ---------------------------------------------------------------------------------------------
-- NUI callbacks. Every one answers, including when the editor is not open.
-- ---------------------------------------------------------------------------------------------
RegisterNUICallback('proptool:ready', function(_, cb)
    Editor.pageReady = true

    cb({
        ok = true,
        config = {
            side = cfg.PanelSide,
            backdropColor = cfg.Backdrop.color,
            defaultModel = cfg.DefaultModel,
            defaultBone = cfg.DefaultBone,
            defaultAnim = cfg.DefaultAnim,
            minZoom = cfg.Camera.minDistance,
        },
        last = Editor.StoreGet('last'),
        copied = Editor.StoreGet('copied'),
        camera = Editor.StoreGet('camera'),
    })
end)

RegisterNUICallback('proptool:store', function(data, cb)
    local ok = type(data) == 'table' and Editor.StoreSet(data.key, data.value)

    reply(cb, ok == true, ok and nil or 'Could not save')
end)

RegisterNUICallback('proptool:close', function(_, cb)
    cb({ ok = true })
    close()
end)

RegisterNUICallback('proptool:typing', function(data, cb)
    cb({ ok = true })
    Editor.typing = type(data) == 'table' and data.value == true
end)

RegisterNUICallback('proptool:zoom', function(data, cb)
    cb({ ok = true })

    if Editor.active and not Editor.testing and type(data) == 'table' then
        Camera.Zoom(tonumber(data.delta) or 0)
    end
end)

-- camera input from the page (RMB drag, WASD, Space, Ctrl, Shift)
RegisterNUICallback('proptool:camKeys', function(data, cb)
    cb({ ok = true })

    if Editor.active and not Editor.testing then Camera.SetKeys(data) end
end)

RegisterNUICallback('proptool:camSpeed', function(data, cb)
    if type(data) ~= 'table' then return reply(cb, false, 'Bad camera speed') end

    reply(cb, Camera.SetSpeed(data.look, data.move), 'That camera speed is not allowed')
end)

RegisterNUICallback('proptool:camLook', function(data, cb)
    cb({ ok = true })

    if Editor.active and not Editor.testing and type(data) == 'table' then Camera.Look(data.dx, data.dy) end
end)

RegisterNUICallback('proptool:checkBones', function(data, cb)
    local invalid = {}

    if Editor.active and type(data) == 'table' and type(data.ids) == 'table' then
        local ped = PlayerPedId()

        for _, id in ipairs(data.ids) do
            if GetPedBoneIndex(ped, id) == -1 then
                invalid[#invalid + 1] = id
            end
        end

        if #invalid > 0 then
            Editor.Debug('bones this ped does not have: ' .. table.concat(invalid, ', '))
        end
    end

    cb({ ok = true, invalid = invalid })
end)

RegisterNUICallback('proptool:bonePick', function(data, cb)
    cb({ ok = true })

    if not Editor.active or type(data) ~= 'table' then return end

    if data.active == true and type(data.ids) == 'table' then
        bonePick = { ids = data.ids }
    else
        bonePick = nil
    end
end)

-- props ----------------------------------------------------------------------------------------
RegisterNUICallback('proptool:propAdd', function(data, cb)
    if not Editor.active then return reply(cb, false, 'The editor is not open') end

    local id, err = Props.Add(data)

    if not id then return reply(cb, false, err) end

    reply(cb, true, nil, { prop = Props.Describe(Editor.props[id]) })
end)

RegisterNUICallback('proptool:propSet', function(data, cb)
    if not Editor.active or type(data) ~= 'table' then return reply(cb, false, 'The editor is not open') end

    local ok, err = Props.Set(tonumber(data.id), data)

    reply(cb, ok, err)
end)

RegisterNUICallback('proptool:propRemove', function(data, cb)
    if not Editor.active or type(data) ~= 'table' then return reply(cb, false, 'The editor is not open') end

    reply(cb, Props.Remove(tonumber(data.id)), 'That prop is not in the editor')
end)

-- animation ------------------------------------------------------------------------------------
RegisterNUICallback('proptool:animPlay', function(data, cb)
    if not Editor.active or type(data) ~= 'table' then return reply(cb, false, 'The editor is not open') end

    local ok, err = Anim.Play(data.dict, data.name, data.flag)

    reply(cb, ok, err, { anim = Anim.Describe() })
end)

RegisterNUICallback('proptool:animStop', function(_, cb)
    if Editor.active then Anim.Stop() end

    reply(cb, true)
end)

RegisterNUICallback('proptool:animPause', function(data, cb)
    if not Editor.active or type(data) ~= 'table' then return reply(cb, false, 'The editor is not open') end

    reply(cb, Anim.SetPaused(data.paused), 'There is no animation to pause')
end)

RegisterNUICallback('proptool:animSeek', function(data, cb)
    if not Editor.active or type(data) ~= 'table' then return reply(cb, false, 'The editor is not open') end

    reply(cb, Anim.Seek(data.fraction), 'There is no animation to scrub')
end)

RegisterNUICallback('proptool:animSpeed', function(data, cb)
    if not Editor.active or type(data) ~= 'table' then return reply(cb, false, 'The editor is not open') end

    reply(cb, Anim.SetSpeed(data.speed), 'That speed is not allowed')
end)

-- scene ----------------------------------------------------------------------------------------
RegisterNUICallback('proptool:scene', function(data, cb)
    if not Editor.active then return reply(cb, false, 'The editor is not open') end

    reply(cb, Scene.Set(data), 'Could not change the scene')
end)

-- gizmo ----------------------------------------------------------------------------------------
RegisterNUICallback('proptool:gizmoStart', function(data, cb)
    if not Editor.active or type(data) ~= 'table' then return reply(cb, false, 'The editor is not open') end

    reply(cb, Gizmo.StartUi(tonumber(data.id)), 'The gizmo could not open')
end)

RegisterNUICallback('proptool:gizmoMove', function(data, cb)
    cb({ ok = true })

    if Editor.active then Gizmo.Move(data) end
end)

RegisterNUICallback('proptool:gizmoSave', function(_, cb)
    reply(cb, Gizmo.Save(), 'No gizmo is open')
end)

RegisterNUICallback('proptool:gizmoCancel', function(_, cb)
    reply(cb, Gizmo.Cancel(), 'No gizmo is open')
end)

RegisterNUICallback('proptool:gizmoNative', function(data, cb)
    if not Editor.active or type(data) ~= 'table' then return reply(cb, false, 'The editor is not open') end
    if not Editor.nativeGizmo then return reply(cb, false, 'The native gizmo is not available on this server') end

    reply(cb, Gizmo.StartNative(tonumber(data.id)), 'The native gizmo could not open')
end)

-- test mode ------------------------------------------------------------------------------------
RegisterNUICallback('proptool:test', function(_, cb)
    if not Editor.active then return reply(cb, false, 'The editor is not open') end

    reply(cb, startTest(), 'Close the gizmo first')
end)

-- ---------------------------------------------------------------------------------------------
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end

    if Editor.active then close(nil, true) end

    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
end)
