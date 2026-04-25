player.onItemInteracted(COMPASS, function () {
    Zones.zone(zone, function (name, origin, terminal) {
        blocks.fill(
        STONE,
        origin,
        terminal,
        FillOperation.Replace
        )
    })
    Zones.zone(zone, function (name, origin, terminal) {
        blocks.fill(
        AIR,
        origin,
        terminal,
        FillOperation.Replace
        )
    })
})
let zone: MinecraftZone = null
zone = Zones.space(world(-250, 0, -250), world(250, 150, 250))
player.say(Zones.zoneToString(zone))
