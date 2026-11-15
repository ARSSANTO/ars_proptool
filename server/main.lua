-- The only way in: run the command, the client opens the editor. No permission check: start the resource when it is needed.
-- The native gizmo is driven by the game's own gizmo commands. A server that does not let resources run them
-- simply does not get the native gizmo (the UI gizmo needs nothing), so there is nothing to configure.
local GIZMO_COMMANDS = { 'gizmoSelect', 'gizmoTranslation', 'gizmoRotation', 'gizmoLocal' }

local function nativeGizmoAllowed()
    local principal = 'resource.' .. GetCurrentResourceName()

    for _, name in ipairs(GIZMO_COMMANDS) do
        if not IsPrincipalAceAllowed(principal, 'command.+' .. name) or not IsPrincipalAceAllowed(principal, 'command.-' .. name) then
            return false
        end
    end

    return true
end

RegisterCommand(ProptoolConfig.Command, function(source, args)
    if source == 0 then
        print('[ars_proptool] the editor opens on a player: run /' .. ProptoolConfig.Command .. ' in game')
        return
    end

    TriggerClientEvent('ars_proptool:client:Open', source, args[1], nativeGizmoAllowed())
end, false)
