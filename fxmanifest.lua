fx_version 'cerulean'
game 'gta5'
lua54 'yes'
description 'Prop attach editor: place props on the ped with a gizmo, preview the animation, copy the result'
version '1.0.0'

shared_scripts {
    'config/config.lua',
}

server_scripts {
    'server/main.lua',
}

client_scripts {
    'client/utils.lua',
    'client/props.lua',
    'client/anim.lua',
    'client/camera.lua',
    'client/stage.lua',
    'client/scene.lua',
    'client/native_gizmo.lua',
    'client/gizmo.lua',
    'client/main.lua',
}

ui_page 'web/build/index.html'

files {
    'web/build/index.html',
    'web/build/assets/**/*',
}
