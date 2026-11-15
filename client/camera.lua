-- Orbit camera around the ped. While the editor page has focus the page sends the input (RMB drag, WASD, Space, Ctrl,
-- Shift), so no key reaches the game and nothing else the server binds can fire. While it has not (the native gizmo)
-- the same input is read from the controls. Getting in and out is a plain cut, no camera moves.
Camera = {}

local cfg = ProptoolConfig.Camera
local cam, yaw, pitch, distance, panX, panY, panZ

local keys = { forward = false, back = false, left = false, right = false, up = false, down = false, slow = false }
local lookX, lookY = 0.0, 0.0 -- mouse pixels the page has sent and the frame has not used yet
local lookMul, moveMul = 1.0, 1.0 -- the panel's Look speed and Move speed

local PANEL_FRACTION = 56.2 / 108.0 -- the panel's right edge (22 margin + 540 wide) over the screen height in the same units
local CONTROL = { look = 25, lookX = 1, lookY = 2, forward = 32, back = 33, left = 34, right = 35, up = 22, down = 36, slow = 21 }

local function clamp(value, min, max)
    return math.max(min, math.min(max, value))
end

-- Unit vectors on the ground for the current yaw: (outX, outY) points from the ped to the camera, (rightX, rightY) is screen right
local function axes()
    local rad = math.rad(yaw)
    local outX, outY = -math.sin(rad), math.cos(rad)

    return outX, outY, -outY, outX
end

function Camera.IsRunning()
    return cam ~= nil
end

function Camera.SetKeys(data)
    for name in pairs(keys) do
        keys[name] = type(data) == 'table' and data[name] == true
    end
end

function Camera.Look(dx, dy)
    if not Editor.IsNumber(dx) or not Editor.IsNumber(dy) then return end

    lookX, lookY = lookX + dx, lookY + dy
end

function Camera.SetSpeed(look, move)
    look, move = tonumber(look), tonumber(move)

    if not look or not move or look < 0.1 or look > 3.0 or move < 0.1 or move > 3.0 then
        Editor.Debug('camera speed refused', tostring(look), tostring(move))
        return false
    end

    lookMul, moveMul = look + 0.0, move + 0.0

    return true
end

function Camera.ReleaseInput()
    for name in pairs(keys) do keys[name] = false end

    lookX, lookY = 0.0, 0.0
end

-- In front of the ped, the whole body in view, the ped in the middle of the free part of the screen
function Camera.Start()
    yaw = GetEntityHeading(PlayerPedId())
    pitch = 8.0
    distance = cfg.distance
    panX, panY, panZ = 0.0, 0.0, 0.0
    Camera.ReleaseInput()

    cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    SetCamFov(cam, cfg.fov)
    Camera.Update(0.0, false)
    SetCamActive(cam, true)
    RenderScriptCams(true, false, 0, true, false)
end

function Camera.Stop()
    if not cam then return end

    RenderScriptCams(false, false, 0, true, false)
    DestroyCam(cam, false)
    cam = nil

    -- the game camera comes back behind the ped, not wherever it was left
    SetGameplayCamRelativeHeading(0.0)
    SetGameplayCamRelativePitch(0.0, 1.0)
end

-- Hand the view to the game for test mode and take it back afterwards
function Camera.Pause()
    if cam then RenderScriptCams(false, false, 0, true, false) end
end

function Camera.Resume()
    if cam then RenderScriptCams(true, false, 0, true, false) end
end

function Camera.Zoom(direction)
    if not cam or not Editor.IsNumber(direction) then return end

    distance = clamp(distance + (direction > 0 and 1 or -1) * cfg.zoomStep, cfg.minDistance, cfg.maxDistance)
end

function Camera.Distance()
    return distance
end

local function readControls()
    for name, control in pairs({ forward = CONTROL.forward, back = CONTROL.back, left = CONTROL.left, right = CONTROL.right, up = CONTROL.up, down = CONTROL.down, slow = CONTROL.slow }) do
        keys[name] = IsDisabledControlPressed(0, control)
    end

    if IsDisabledControlPressed(0, CONTROL.look) then
        EnableControlAction(0, CONTROL.lookX, true)
        EnableControlAction(0, CONTROL.lookY, true)

        -- the controls give a delta per frame; the page gives pixels
        lookX = lookX + GetDisabledControlNormal(0, CONTROL.lookX) * cfg.gameLook / cfg.lookPerPixel
        lookY = lookY + GetDisabledControlNormal(0, CONTROL.lookY) * cfg.gameLook / cfg.lookPerPixel
    end
end

-- Every frame. dt in seconds; fromControls when the page has no focus.
function Camera.Update(dt, fromControls)
    if not cam then return end

    if fromControls then readControls() end

    local slow = keys.slow and cfg.precision or 1.0

    if lookX ~= 0.0 or lookY ~= 0.0 then
        yaw = (yaw - lookX * cfg.lookPerPixel * lookMul * slow) % 360.0
        pitch = clamp(pitch + lookY * cfg.lookPerPixel * lookMul * slow, -25.0, 80.0)
        lookX, lookY = 0.0, 0.0
    end

    local outX, outY, rightX, rightY = axes()

    if dt > 0.0 and not Editor.typing then
        local step = cfg.panSpeed * moveMul * dt * slow * math.max(distance / cfg.distance, 0.4)

        if keys.forward then panY = clamp(panY + step, -3.0, 3.0) end
        if keys.back then panY = clamp(panY - step, -3.0, 3.0) end
        if keys.left then panX = clamp(panX - step, -3.0, 3.0) end
        if keys.right then panX = clamp(panX + step, -3.0, 3.0) end
        if keys.up then panZ = clamp(panZ + step, -2.5, 2.5) end
        if keys.down then panZ = clamp(panZ - step, -2.5, 2.5) end
    end

    local base = GetEntityCoords(PlayerPedId())
    -- panY moves the view towards the ped (the opposite of the way the camera sits)
    local pivotX = base.x + rightX * panX - outX * panY
    local pivotY = base.y + rightY * panX - outY * panY
    local pivotZ = base.z + cfg.height + panZ

    -- the ped sits in the middle of the free part of the screen: the panel covers PANEL_FRACTION of the half width
    -- whatever the aspect ratio, and a shift of d * tan(fov / 2) * fraction centres it
    local shift = distance * math.tan(math.rad(cfg.fov / 2.0)) * PANEL_FRACTION * (ProptoolConfig.PanelSide == 'left' and -1.0 or 1.0)
    local flat = math.cos(math.rad(pitch))

    SetCamCoord(
        cam,
        pivotX + outX * distance * flat + rightX * shift,
        pivotY + outY * distance * flat + rightY * shift,
        pivotZ + math.sin(math.rad(pitch)) * distance
    )
    PointCamAtCoord(cam, pivotX + rightX * shift, pivotY + rightY * shift, pivotZ)
end

-- Where the game draws from (the gizmo page follows this)
function Camera.View()
    return GetFinalRenderedCamCoord(), GetFinalRenderedCamRot(0)
end

-- Centre and size of the backdrop box so the camera stays inside it
function Camera.BackdropBox()
    local base = GetEntityCoords(PlayerPedId())
    local half = math.max(ProptoolConfig.Backdrop.minHalf, distance * 1.5 + 4.0)

    return base, half
end
