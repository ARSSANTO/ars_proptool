-- Shared state and maths for the editor. Every client file hangs its part off `Editor`.
Editor = {
    active = false,
    testing = false,
    typing = false, -- a text field has focus: WASD must not move the camera
    pageReady = false,
    props = {}, -- [id] = { id, model, bone, handle, pos, rot, order, visible }
    nextId = 1,
}

function Editor.Debug(...)
    print('[ars_proptool]', ...)
end

function Editor.Send(action, data)
    SendNUIMessage({ action = action, data = data or {} })
end

-- Esc is the editor's key; when focus goes back to the game the pause menu must not take the same press
function Editor.BlockPause(ms)
    CreateThread(function()
        local limit = GetGameTimer() + ms

        while GetGameTimer() < limit do
            DisableControlAction(0, 199, true)
            DisableControlAction(0, 200, true)
            Wait(0)
        end
    end)
end

function Editor.Notify(description)
    BeginTextCommandThefeedPost('STRING')
    AddTextComponentSubstringPlayerName(('Prop editor: %s'):format(description))
    EndTextCommandThefeedPostTicker(false, false)
end

-- Loads a model. Returns its hash, or nil and 'missing' (no such model) / 'timeout' (did not load in time).
function Editor.LoadModel(model, timeout)
    local hash = type(model) == 'number' and model or joaat(model)

    if HasModelLoaded(hash) then return hash end

    if not IsModelValid(hash) or not IsModelInCdimage(hash) then return nil, 'missing' end

    RequestModel(hash)

    local limit = GetGameTimer() + timeout

    while not HasModelLoaded(hash) and GetGameTimer() < limit do
        Wait(0)
    end

    if not HasModelLoaded(hash) then return nil, 'timeout' end

    return hash
end

-- Loads an animation dictionary. Returns true when it is ready.
function Editor.LoadAnimDict(dict, timeout)
    if type(dict) ~= 'string' or not DoesAnimDictExist(dict) then return false end

    if HasAnimDictLoaded(dict) then return true end

    RequestAnimDict(dict)

    local limit = GetGameTimer() + timeout

    while not HasAnimDictLoaded(dict) and GetGameTimer() < limit do
        Wait(0)
    end

    return HasAnimDictLoaded(dict)
end

-- A key the player can rebind in the game's keybind settings: { name, description, defaultKey, defaultMapper?, onPressed?, onReleased? }
function Editor.AddKeybind(data)
    local command = 'proptool_' .. data.name

    RegisterCommand('+' .. command, function()
        if data.onPressed then data.onPressed() end
    end, false)

    RegisterCommand('-' .. command, function()
        if data.onReleased then data.onReleased() end
    end, false)

    RegisterKeyMapping('+' .. command, data.description, data.defaultMapper or 'keyboard', data.defaultKey)
end

function Editor.IsNumber(value)
    return type(value) == 'number' and value == value and value > -1e9 and value < 1e9
end

-- { x, y, z } with finite numbers, or nil
function Editor.ReadVec(value)
    if type(value) ~= 'table' then return nil end

    local x, y, z = tonumber(value.x), tonumber(value.y), tonumber(value.z)

    if not (x and y and z and Editor.IsNumber(x) and Editor.IsNumber(y) and Editor.IsNumber(z)) then return nil end

    return { x = x, y = y, z = z }
end

-- ---------------------------------------------------------------------------------------------
-- Rotations. A quaternion is { x, y, z, w }. Rotation orders are the game's (AttachEntityToEntity's
-- rotationOrder): the axes are multiplied left to right, so order 2 ("ZXY") is Rz * Rx * Ry.
-- ---------------------------------------------------------------------------------------------
local AXES = { [0] = 'ZYX', [1] = 'YZX', [2] = 'ZXY', [3] = 'XZY', [4] = 'YXZ', [5] = 'XYZ' }

local function axisQuat(axis, degrees)
    local half = math.rad(degrees) / 2
    local s, c = math.sin(half), math.cos(half)

    if axis == 'X' then return { x = s, y = 0.0, z = 0.0, w = c } end
    if axis == 'Y' then return { x = 0.0, y = s, z = 0.0, w = c } end

    return { x = 0.0, y = 0.0, z = s, w = c }
end

function Editor.QuatMul(a, b)
    return {
        w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
        x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    }
end

function Editor.QuatInverse(q)
    return { x = -q.x, y = -q.y, z = -q.z, w = q.w }
end

function Editor.EulerToQuat(rot, order)
    local axes = AXES[order] or AXES[2]
    local a = axes:sub(1, 1)
    local b = axes:sub(2, 2)
    local c = axes:sub(3, 3)

    return Editor.QuatMul(
        Editor.QuatMul(axisQuat(a, rot[a:lower()]), axisQuat(b, rot[b:lower()])),
        axisQuat(c, rot[c:lower()])
    )
end

local function clamp1(value)
    return math.max(-1.0, math.min(1.0, value))
end

-- Euler angles (degrees) of `q` in the given order
function Editor.QuatToEuler(q, order)
    local x, y, z, w = q.x, q.y, q.z, q.w
    local xx, yy, zz = x * x, y * y, z * z
    local xy, xz, yz = x * y, x * z, y * z
    local wx, wy, wz = w * x, w * y, w * z

    local m11, m12, m13 = 1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy)
    local m21, m22, m23 = 2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx)
    local m31, m32, m33 = 2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)

    local ex, ey, ez
    local edge = 0.9999999

    if order == 5 then -- XYZ
        ey = math.asin(clamp1(m13))
        if math.abs(m13) < edge then ex, ez = math.atan(-m23, m33), math.atan(-m12, m11)
        else ex, ez = math.atan(m32, m22), 0.0 end
    elseif order == 4 then -- YXZ
        ex = math.asin(-clamp1(m23))
        if math.abs(m23) < edge then ey, ez = math.atan(m13, m33), math.atan(m21, m22)
        else ey, ez = math.atan(-m31, m11), 0.0 end
    elseif order == 0 then -- ZYX
        ey = math.asin(-clamp1(m31))
        if math.abs(m31) < edge then ex, ez = math.atan(m32, m33), math.atan(m21, m11)
        else ex, ez = 0.0, math.atan(-m12, m22) end
    elseif order == 1 then -- YZX
        ez = math.asin(clamp1(m21))
        if math.abs(m21) < edge then ex, ey = math.atan(-m23, m22), math.atan(-m31, m11)
        else ex, ey = 0.0, math.atan(m13, m33) end
    elseif order == 3 then -- XZY
        ez = math.asin(-clamp1(m12))
        if math.abs(m12) < edge then ex, ey = math.atan(m32, m22), math.atan(m13, m11)
        else ex, ey = math.atan(-m23, m33), 0.0 end
    else -- ZXY (2)
        ex = math.asin(clamp1(m32))
        if math.abs(m32) < edge then ey, ez = math.atan(-m31, m33), math.atan(-m12, m22)
        else ey, ez = 0.0, math.atan(m21, m11) end
    end

    return { x = math.deg(ex), y = math.deg(ey), z = math.deg(ez) }
end

function Editor.QuatRotate(q, v)
    local tx = 2 * (q.y * v.z - q.z * v.y)
    local ty = 2 * (q.z * v.x - q.x * v.z)
    local tz = 2 * (q.x * v.y - q.y * v.x)

    return {
        x = v.x + q.w * tx + (q.y * tz - q.z * ty),
        y = v.y + q.w * ty + (q.z * tx - q.x * tz),
        z = v.z + q.w * tz + (q.x * ty - q.y * tx),
    }
end

-- ---------------------------------------------------------------------------------------------
-- Saved per client: last session and the copied list (the page hands over JSON strings)
-- ---------------------------------------------------------------------------------------------
local STORE_KEYS = { last = 'ars_proptool:last', copied = 'ars_proptool:copied', camera = 'ars_proptool:camera' }
local STORE_LIMIT = 60000

function Editor.StoreGet(key)
    local kvp = STORE_KEYS[key]

    return kvp and GetResourceKvpString(kvp) or nil
end

function Editor.StoreSet(key, value)
    local kvp = STORE_KEYS[key]

    if not kvp or type(value) ~= 'string' or #value > STORE_LIMIT then
        Editor.Debug('store refused', tostring(key), type(value), type(value) == 'string' and #value or 0)
        return false
    end

    SetResourceKvp(kvp, value)

    return true
end
