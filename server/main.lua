-- The only way in: run the command, the client opens the editor. No permission check: start the resource when it is needed.
RegisterCommand(ProptoolConfig.Command, function(source, args)
    if source == 0 then
        print('[ars_proptool] the editor opens on a player: run /' .. ProptoolConfig.Command .. ' in game')
        return
    end

    TriggerClientEvent('ars_proptool:client:Open', source, args[1])
end, false)
