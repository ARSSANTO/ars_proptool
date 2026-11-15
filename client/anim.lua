-- The animation the props are previewed with: play, stop, pause, scrub, speed.
Anim = {
    dict = nil,
    name = nil,
    flag = 49,
    speed = 1.0,
    paused = false,
}

local VALID_FLAGS = { [0] = true, [1] = true, [2] = true, [48] = true, [49] = true, [50] = true }

function Anim.IsLoaded()
    return Anim.dict ~= nil
end

function Anim.IsPlaying()
    return Anim.dict ~= nil and IsEntityPlayingAnim(PlayerPedId(), Anim.dict, Anim.name, 3)
end

function Anim.Stop()
    local ped = PlayerPedId()

    if Anim.dict then
        StopAnimTask(ped, Anim.dict, Anim.name, 1.0)
    end

    Anim.dict, Anim.name, Anim.paused = nil, nil, false
end

-- -> ok, reason
function Anim.Play(dict, name, flag)
    if type(dict) ~= 'string' or dict == '' or type(name) ~= 'string' or name == '' then
        Editor.Debug('animation refused, dictionary or name missing')
        return false, 'Type a dictionary and a name'
    end

    flag = math.tointeger(tonumber(flag)) or 49

    if not VALID_FLAGS[flag] then
        Editor.Debug('animation flag not in the list, using 49', flag)
        flag = 49
    end

    if not Editor.LoadAnimDict(dict, 5000) then
        Editor.Debug('animation dictionary refused', dict)
        return false, 'That dictionary does not exist'
    end

    Anim.Stop()

    local ped = PlayerPedId()

    TaskPlayAnim(ped, dict, name, 8.0, -8.0, -1, flag, 0.0, false, false, false)
    Wait(120)

    if not IsEntityPlayingAnim(ped, dict, name, 3) then
        Editor.Debug('clip not found in the dictionary', dict, name)
        return false, 'That clip is not in the dictionary'
    end

    Anim.dict, Anim.name, Anim.flag, Anim.paused = dict, name, flag, false
    SetEntityAnimSpeed(ped, dict, name, Anim.speed)

    return true
end

function Anim.SetSpeed(speed)
    speed = tonumber(speed)

    if not speed or speed <= 0.0 or speed > 4.0 then
        Editor.Debug('animation speed refused', tostring(speed))
        return false
    end

    Anim.speed = speed + 0.0

    if Anim.dict and not Anim.paused then
        SetEntityAnimSpeed(PlayerPedId(), Anim.dict, Anim.name, Anim.speed)
    end

    return true
end

function Anim.SetPaused(paused)
    if not Anim.dict then
        Editor.Debug('pause ignored, no animation is loaded')
        return false
    end

    Anim.paused = paused == true
    SetEntityAnimSpeed(PlayerPedId(), Anim.dict, Anim.name, Anim.paused and 0.0 or Anim.speed)

    return true
end

-- fraction: 0 to 1 through the clip
function Anim.Seek(fraction)
    fraction = tonumber(fraction)

    if not Anim.dict or not fraction then
        Editor.Debug('seek ignored', tostring(Anim.dict), tostring(fraction))
        return false
    end

    SetEntityAnimCurrentTime(PlayerPedId(), Anim.dict, Anim.name, math.max(0.0, math.min(1.0, fraction)))

    return true
end

function Anim.State()
    if not Anim.dict then
        return { loaded = false }
    end

    local ped = PlayerPedId()

    return {
        loaded = true,
        playing = IsEntityPlayingAnim(ped, Anim.dict, Anim.name, 3),
        paused = Anim.paused,
        time = GetEntityAnimCurrentTime(ped, Anim.dict, Anim.name),
    }
end

function Anim.Describe()
    return { dict = Anim.dict, name = Anim.name, flag = Anim.flag, speed = Anim.speed, paused = Anim.paused }
end
