-- The stage around the ped: a solid backdrop, the time of day and the weather. Local only; everything is put
-- back when the editor closes (the editor re-asserts its time and weather once a second while it is open).
local function defaultLight()
    return { enabled = false, r = 255, g = 240, b = 220, brightness = 20.0, spread = 35.0, follow = true }
end

Scene = {
    backdrop = { enabled = false, r = 10, g = 75, b = 208, a = 255 },
    light = defaultLight(),
    hour = nil, -- hours 0-24 with decimals, nil = leave the world's time
    weather = nil,
    lastTime = 0,
    clock = nil, -- { hour, minute, at } what the clock showed when the editor opened
}

local WEATHERS = {
    EXTRASUNNY = true, CLEAR = true, NEUTRAL = true, SMOG = true, FOGGY = true, OVERCAST = true,
    CLOUDS = true, CLEARING = true, RAIN = true, THUNDER = true, SNOW = true, BLIZZARD = true,
    SNOWLIGHT = true, XMAS = true, HALLOWEEN = true,
}

local function hexToRgb(hex)
    if type(hex) ~= 'string' then return nil end

    -- #RRGGBB or #RRGGBBAA
    local r, g, b, a = hex:match('^#?(%x%x)(%x%x)(%x%x)(%x%x)$')

    if not r then r, g, b = hex:match('^#?(%x%x)(%x%x)(%x%x)$') end

    if not r then return nil end

    return tonumber(r, 16), tonumber(g, 16), tonumber(b, 16), a and tonumber(a, 16) or 255
end

local function applyTime()
    if not Scene.hour then return end

    local whole = math.floor(Scene.hour)
    local minute = math.floor((Scene.hour - whole) * 60)

    NetworkOverrideClockTime(whole % 24, minute, 0)
end

function Scene.Describe()
    return {
        backdrop = { enabled = Scene.backdrop.enabled, color = ('#%02X%02X%02X%02X'):format(Scene.backdrop.r, Scene.backdrop.g, Scene.backdrop.b, Scene.backdrop.a) },
        hour = Scene.hour,
        weather = Scene.weather,
        light = {
            enabled = Scene.light.enabled,
            color = ('#%02X%02X%02X'):format(Scene.light.r, Scene.light.g, Scene.light.b),
            brightness = Scene.light.brightness,
            spread = Scene.light.spread,
            follow = Scene.light.follow,
        },
    }
end

-- data: { backdrop = { enabled, color }, hour, weather } - any part
function Scene.Set(data)
    if type(data) ~= 'table' then
        Editor.Debug('scene refused, not a table')
        return false
    end

    if type(data.backdrop) == 'table' then
        if data.backdrop.enabled ~= nil then Scene.backdrop.enabled = data.backdrop.enabled == true end

        if data.backdrop.color ~= nil then
            local r, g, b, a = hexToRgb(data.backdrop.color)

            if r then
                Scene.backdrop.r, Scene.backdrop.g, Scene.backdrop.b, Scene.backdrop.a = r, g, b, a
            else
                Editor.Debug('backdrop colour refused', tostring(data.backdrop.color))
            end
        end
    end

    if type(data.light) == 'table' then
        local light, patch = Scene.light, data.light

        if patch.enabled ~= nil then light.enabled = patch.enabled == true end
        if patch.follow ~= nil then light.follow = patch.follow == true end

        if patch.color ~= nil then
            local r, g, b = hexToRgb(patch.color)

            if r then light.r, light.g, light.b = r, g, b else Editor.Debug('light colour refused', tostring(patch.color)) end
        end

        if patch.brightness ~= nil then
            local value = tonumber(patch.brightness)

            if value and value >= 0.0 and value <= 100.0 then light.brightness = value + 0.0 else Editor.Debug('light brightness refused', tostring(patch.brightness)) end
        end

        if patch.spread ~= nil then
            local value = tonumber(patch.spread)

            if value and value >= 1.0 and value <= 90.0 then light.spread = value + 0.0 else Editor.Debug('light spread refused', tostring(patch.spread)) end
        end
    end

    if data.hour ~= nil then
        local hour = tonumber(data.hour)

        if hour and hour >= 0.0 and hour <= 24.0 then
            Scene.hour = hour + 0.0
            applyTime()
        else
            Editor.Debug('hour refused', tostring(data.hour))
        end
    end

    if data.weather ~= nil then
        if WEATHERS[data.weather] then
            Scene.weather = data.weather
            SetOverrideWeather(data.weather)
        else
            Editor.Debug('weather refused', tostring(data.weather))
        end
    end

    return true
end

-- A spotlight on the ped: from the camera (a headlamp) or from the front and above
local function drawLight()
    local light = Scene.light

    if not light.enabled then return end

    local ped = PlayerPedId()
    local at = GetEntityCoords(ped)
    local target = vector3(at.x, at.y, at.z + 0.3)
    local from

    if light.follow then
        from = GetFinalRenderedCamCoord()
    else
        local rad = math.rad(GetEntityHeading(ped))

        from = vector3(at.x - math.sin(rad) * 2.4, at.y + math.cos(rad) * 2.4, at.z + 2.2)
    end

    local direction = target - from
    local length = #direction

    if length < 0.05 then return end

    direction = direction / length

    DrawSpotLight(
        from.x, from.y, from.z,
        direction.x, direction.y, direction.z,
        light.r, light.g, light.b,
        length + 6.0, light.brightness, 1.0, light.spread, 1.0
    )
end

-- Every frame while the editor shows the scene
function Scene.Draw()
    drawLight()

    if not Scene.backdrop.enabled then return end

    local centre, half = Camera.BackdropBox()
    local floorZ = centre.z - 0.98 -- the ped stands on the platform, its centre is about a metre above the feet
    local top = centre.z + half
    local x0, x1, y0, y1 = centre.x - half, centre.x + half, centre.y - half, centre.y + half
    local r, g, b, alpha = Scene.backdrop.r, Scene.backdrop.g, Scene.backdrop.b, Scene.backdrop.a

    local v = {
        { x0, y0, floorZ }, { x1, y0, floorZ }, { x1, y1, floorZ }, { x0, y1, floorZ },
        { x0, y0, top }, { x1, y0, top }, { x1, y1, top }, { x0, y1, top },
    }
    local faces = {
        { 1, 2, 3, 4 }, { 5, 6, 7, 8 }, { 1, 2, 6, 5 }, { 2, 3, 7, 6 }, { 3, 4, 8, 7 }, { 4, 1, 5, 8 },
    }

    -- both windings, so the inside of the box is drawn whichever way the game culls
    for _, f in ipairs(faces) do
        local a, c, d, e = v[f[1]], v[f[2]], v[f[3]], v[f[4]]

        DrawPoly(a[1], a[2], a[3], c[1], c[2], c[3], d[1], d[2], d[3], r, g, b, alpha)
        DrawPoly(a[1], a[2], a[3], d[1], d[2], d[3], c[1], c[2], c[3], r, g, b, alpha)
        DrawPoly(a[1], a[2], a[3], d[1], d[2], d[3], e[1], e[2], e[3], r, g, b, alpha)
        DrawPoly(a[1], a[2], a[3], e[1], e[2], e[3], d[1], d[2], d[3], r, g, b, alpha)
    end
end

-- The world's time and weather push in now and then; keep the editor's choice on top
function Scene.Tick()
    local now = GetGameTimer()

    if now - Scene.lastTime < 1000 then return end

    Scene.lastTime = now
    applyTime()

    if Scene.weather then SetOverrideWeather(Scene.weather) end
end

-- Back to the world's own weather and clock. The editor only overrides them locally: the weather override is
-- cleared, and the clock is set to where it would be by now (what it showed when the editor opened plus what has
-- passed since), so whatever drives the clock carries on from the right time.
function Scene.Restore()
    ClearOverrideWeather()

    if Scene.hour and Scene.clock then
        local passed = (GetGameTimer() - Scene.clock.at) / math.max(GetMillisecondsPerGameMinute(), 1)
        local minutes = math.floor(Scene.clock.hour * 60 + Scene.clock.minute + passed) % 1440

        NetworkOverrideClockTime(minutes // 60, minutes % 60, 0)
    end

    Scene.hour, Scene.weather = nil, nil
    Scene.backdrop.enabled = false
    Scene.light.enabled = false
end

function Scene.Reset()
    local r, g, b, a = hexToRgb(ProptoolConfig.Backdrop.color)

    Scene.backdrop = { enabled = false, r = r or 10, g = g or 75, b = b or 208, a = a or 255 }
    Scene.light = defaultLight()
    Scene.hour, Scene.weather = nil, nil
    Scene.clock = { hour = GetClockHours(), minute = GetClockMinutes(), at = GetGameTimer() }
end
