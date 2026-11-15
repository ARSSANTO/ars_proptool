-- Props attached to the player ped. The page sends the numbers, this file turns them into entities.
Props = {}

local ZERO = { x = 0.0, y = 0.0, z = 0.0 }

local function copyVec(v)
    return { x = v.x + 0.0, y = v.y + 0.0, z = v.z + 0.0 }
end

local function attach(prop)
    if not prop.handle or not DoesEntityExist(prop.handle) then
        Editor.Debug('attach skipped, the prop entity is gone', prop.id, prop.model)
        return false, 'The prop is gone'
    end

    local ped = PlayerPedId()
    local bone = GetPedBoneIndex(ped, prop.bone)

    if bone == -1 then
        Editor.Debug('bone not on this ped', prop.bone)
        return false, ('The ped has no bone %s'):format(prop.bone)
    end

    AttachEntityToEntity(
        prop.handle, ped, bone,
        prop.pos.x, prop.pos.y, prop.pos.z,
        prop.rot.x, prop.rot.y, prop.rot.z,
        true, true, false, true, prop.order, true
    )
    SetEntityVisible(prop.handle, prop.visible, false)

    return true
end

local function spawn(prop)
    local hash, why = Editor.LoadModel(prop.model, 5000)

    if not hash then
        Editor.Debug('model refused', prop.model, why)
        return false, why == 'timeout' and 'The model did not load, try again' or 'That model does not exist'
    end

    local at = GetEntityCoords(PlayerPedId())
    local handle = CreateObject(hash, at.x, at.y, at.z + 1.0, false, false, false)

    SetModelAsNoLongerNeeded(hash)

    if not handle or handle == 0 then
        Editor.Debug('CreateObject failed', prop.model)
        return false, 'The game could not create that prop'
    end

    SetEntityCollision(handle, false, false)
    prop.handle = handle

    return true
end

local function destroy(prop)
    if prop.handle and DoesEntityExist(prop.handle) then
        DetachEntity(prop.handle, false, false)
        DeleteEntity(prop.handle)
    end

    prop.handle = nil
end

-- What the page keeps for one prop
function Props.Describe(prop)
    return {
        id = prop.id,
        model = prop.model,
        bone = prop.bone,
        pos = prop.pos,
        rot = prop.rot,
        order = prop.order,
        visible = prop.visible,
    }
end

function Props.List()
    local list = {}

    for _, prop in pairs(Editor.props) do
        list[#list + 1] = Props.Describe(prop)
    end

    table.sort(list, function(a, b) return a.id < b.id end)

    return list
end

-- data: { model, bone, pos?, rot?, order?, visible? } -> id, or nil + reason
function Props.Add(data)
    if type(data) ~= 'table' or type(data.model) ~= 'string' or data.model == '' then
        Editor.Debug('add refused, no model', type(data))
        return nil, 'Type a prop model'
    end

    local bone = math.tointeger(tonumber(data.bone))

    if not bone then
        Editor.Debug('add refused, bad bone', tostring(data.bone))
        return nil, 'Pick a bone'
    end

    local order = math.tointeger(tonumber(data.order)) or 2

    if order < 0 or order > 5 then order = 2 end

    local prop = {
        id = Editor.nextId,
        model = data.model,
        bone = bone,
        pos = Editor.ReadVec(data.pos) and copyVec(data.pos) or copyVec(ZERO),
        rot = Editor.ReadVec(data.rot) and copyVec(data.rot) or copyVec(ZERO),
        order = order,
        visible = data.visible ~= false,
    }

    local ok, err = spawn(prop)

    if not ok then return nil, err end

    ok, err = attach(prop)

    if not ok then
        destroy(prop)
        return nil, err
    end

    Editor.nextId = Editor.nextId + 1
    Editor.props[prop.id] = prop

    return prop.id
end

-- Any of model, bone, pos, rot, order, visible. A new model respawns the prop.
function Props.Set(id, data)
    local prop = Editor.props[id]

    if not prop or type(data) ~= 'table' then
        Editor.Debug('set refused, unknown prop', tostring(id))
        return false, 'That prop is not in the editor'
    end

    local before = { model = prop.model, bone = prop.bone, pos = prop.pos, rot = prop.rot, order = prop.order, visible = prop.visible }

    if type(data.model) == 'string' and data.model ~= '' and data.model ~= prop.model then
        local old = prop.handle

        prop.model = data.model
        prop.handle = nil

        local ok, err = spawn(prop)

        if not ok then
            prop.model = before.model
            prop.handle = old
            return false, err
        end

        if old and DoesEntityExist(old) then
            DeleteEntity(old)
        end
    end

    local bone = math.tointeger(tonumber(data.bone))
    if bone then prop.bone = bone end

    local order = math.tointeger(tonumber(data.order))
    if order and order >= 0 and order <= 5 then prop.order = order end

    if data.pos ~= nil then
        local pos = Editor.ReadVec(data.pos)
        if pos then prop.pos = copyVec(pos) else Editor.Debug('set ignored a bad position', id) end
    end

    if data.rot ~= nil then
        local rot = Editor.ReadVec(data.rot)
        if rot then prop.rot = copyVec(rot) else Editor.Debug('set ignored a bad rotation', id) end
    end

    if data.visible ~= nil then prop.visible = data.visible == true end

    local ok, err = attach(prop)

    if not ok then
        prop.bone, prop.pos, prop.rot, prop.order, prop.visible = before.bone, before.pos, before.rot, before.order, before.visible
        attach(prop)
        return false, err
    end

    return true
end

function Props.Remove(id)
    local prop = Editor.props[id]

    if not prop then
        Editor.Debug('remove refused, unknown prop', tostring(id))
        return false
    end

    destroy(prop)
    Editor.props[id] = nil

    return true
end

function Props.Clear()
    for id in pairs(Editor.props) do
        Props.Remove(id)
    end
end

-- A bone changed under the props (the ped model changed): put them all back
function Props.Reattach()
    for _, prop in pairs(Editor.props) do
        attach(prop)
    end
end

-- ---------------------------------------------------------------------------------------------
-- Gizmo maths. The bone's own frame is worked out from the prop's settled world pose and the
-- offsets it is attached with (world = bone * local), so no bone-rotation native is needed.
-- Only valid while the animation is held still.
-- ---------------------------------------------------------------------------------------------
function Props.WorldPose(prop)
    local at = GetEntityCoords(prop.handle)
    local rot = GetEntityRotation(prop.handle, 2)

    return { position = { x = at.x, y = at.y, z = at.z }, rotation = { x = rot.x, y = rot.y, z = rot.z } }
end

function Props.BoneFrame(prop)
    local pose = Props.WorldPose(prop)
    local world = Editor.EulerToQuat(pose.rotation, 2)
    local rotation = Editor.QuatMul(world, Editor.QuatInverse(Editor.EulerToQuat(prop.rot, prop.order)))
    local offset = Editor.QuatRotate(rotation, prop.pos)

    return {
        rotation = rotation,
        position = {
            x = pose.position.x - offset.x,
            y = pose.position.y - offset.y,
            z = pose.position.z - offset.z,
        },
    }
end

-- Where a world pose sits in the bone's space, in the prop's own rotation order
function Props.WorldToLocal(frame, prop, position, rotation)
    local inverse = Editor.QuatInverse(frame.rotation)
    local pos = Editor.QuatRotate(inverse, {
        x = position.x - frame.position.x,
        y = position.y - frame.position.y,
        z = position.z - frame.position.z,
    })
    local rot = Editor.QuatToEuler(Editor.QuatMul(inverse, Editor.EulerToQuat(rotation, 2)), prop.order)

    return pos, rot
end
