import { world, EntityRidingComponent, system, Player, ItemStack, BlockVolumeBase, BlockVolume } from "@minecraft/server"

// world.afterEvents.playerInteractWithEntity.subscribe( data => {
//     const entity = data.target
//     const player = data.player
//     player.getRi
//     player.sendMessage("mob clicked")
//     /**
//      * @type {EntityRideableComponent}
//      */
//     const rided = entity.getComponent("minecraft:rideable")
//     const item = data.itemStack
//     if (!rided.getRiders().map(val => val.id).includes(player.id) || entity.typeId != "minecraft:happy_ghast" || item.typeId != "minecraft:tnt" ) return

//     player.runCommand("clear @s tnt 1 1")

//     player.dimension.spawnEntity("minecraft:tnt" ,player.location)

// })

world.afterEvents.itemUse.subscribe(data => {
    const player = data.source
    /**
     * @type {EntityRidingComponent}
     */
    const riding = player.getComponent("minecraft:riding")
    const ghast = riding.entityRidingOn
    if (ghast.typeId != "minecraft:happy_ghast") return

    if (data.itemStack.typeId == "minecraft:tnt") {
        player.runCommand("clear @s tnt 1 1");
        // Calcule le vecteur "gauche" du ghast (cross product avec l'axe Y)
        const viewDir = normalizeVector3(ghast.getViewDirection());
        // Axe Y (vertical)
        const up = { x: 0, y: 1, z: 0 };
        // Produit vectoriel pour obtenir la direction gauche
        const left = {
            x: up.y * viewDir.z - up.z * viewDir.y,
            y: up.z * viewDir.x - up.x * viewDir.z,
            z: up.x * viewDir.y - up.y * viewDir.x
        };
        const leftNorm = normalizeVector3(left);
        // Position à gauche du ghast
        const spawnPos = addVector3(addVector3(ghast.location, multiplyVector3(leftNorm, 2.5)), { x: 0, y: 2, z: 0 });
        const tnt = player.dimension.spawnEntity("minecraft:tnt", spawnPos);
    }
    if (data.itemStack.typeId == "minecraft:fire_charge") {
        const fireball = ghast.dimension.spawnEntity("minecraft:fireball", addVector3(ghast.location, multiplyVector3(normalizeVector3(ghast.getViewDirection()), 4)))

        fireball.applyImpulse(ghast.getViewDirection())

        player.runCommand("clear @s fire_charge 1 1")
    }
})
/**
 * @type {Player[]}
 */
var player_arrows = []
world.afterEvents.itemStartUse.subscribe(data => {
    const player = data.source
    /**
     * @type {EntityRidingComponent}
     */
    const riding = player.getComponent("minecraft:riding")
    const ghast = riding.entityRidingOn
    if (ghast.typeId != "minecraft:happy_ghast" || data.itemStack.typeId != "minecraft:bow") return
    player_arrows.push(player)
    ghast.setProperty("minecraft:gatling", true)
})

world.afterEvents.itemStopUse.subscribe(data => {
    const player = data.source
    /**
     * @type {EntityRidingComponent}
     */
    const riding = player.getComponent("minecraft:riding")
    const ghast = riding.entityRidingOn
    if (ghast.typeId != "minecraft:happy_ghast" || data.itemStack.typeId != "minecraft:bow") return
    player_arrows.splice(player_arrows.indexOf(player), 1)
    ghast.setProperty("minecraft:gatling", false)
})

system.runInterval(() => {
    player_arrows.forEach(player => {
        const riding = player.getComponent("minecraft:riding")
        const ghast = riding?.entityRidingOn
        if (ghast?.typeId != "minecraft:happy_ghast" || !playerHasItem(player, "minecraft:arrow")) {
            player_arrows.splice(player_arrows.indexOf(player), 1)
            return
        }
        // 1) Récupère position yeux et vecteur de vue
        const eyePos = ghast.getHeadLocation();
        const viewDir = ghast.getViewDirection();

        // 2) Calcule yaw et pitch en degrés
        const yaw = Math.atan2(viewDir.x, viewDir.z) * (180 / Math.PI);
        const pitch = Math.asin(viewDir.y) * (180 / Math.PI);

        // 4) Spawn avec rotation
        const arrow = ghast.dimension.spawnEntity("minecraft:arrow", {
            x: eyePos.x + viewDir.x * 5,
            y: eyePos.y + viewDir.y * 5,
            z: eyePos.z + viewDir.z * 5
        });

        // const arrow = player.dimension.spawnEntity("minecraft:arrow", addVector3(player.location, multiplyVector3(normalizeVector3(player.getViewDirection()), 2)))
        arrow.setRotation({ x: pitch, y: yaw });
        arrow.applyImpulse(multiplyVector3(ghast.getViewDirection(), 2))
        player.playSound("random.bow");
        // player.runCommand("clear @s arrow 0 1")
        playerClearItem(player, "minecraft:arrow", 1)
    })
}, 2)

system.runInterval(() => {
    world.getPlayers().forEach(player => {
        const ghast = player.getComponent("minecraft:riding")?.entityRidingOn
        if (ghast) {
            if (ghast.getProperty("minecraft:ghast_type") == "plower") {
                const volume = new BlockVolume({ x: ghast.location.x - 2, y: ghast.location.y, z: ghast.location.z - 2 }, { x: ghast.location.x + 2, y: ghast.location.y - 8, z: ghast.location.z + 2 })
                const blocks = ghast.dimension.getBlocks(volume, { includeTypes: ["grass_block"] })//, "dirt"

                for (const block of blocks.getBlockLocationIterator()) {
                    ghast.dimension.setBlockType(block, "farmland")
                    ghast.dimension.setBlockType(addVector3(block, { x: 0, y: 1, z: 0 }), "air")
                }

                const blocksDirt = ghast.dimension.getBlocks(volume, { includeTypes: ["grass_block"] })//, "dirt"

                for (const block of blocksDirt.getBlockLocationIterator()) {
                    ghast.dimension.setBlockType(block, "farmland")
                }
                player.playSound("use.gravel")

            }
        }
    })
}, 10)

function playerHasItem(player, itemId) {
    // Récupère le composant d'inventaire
    const invComp = player.getComponent("minecraft:inventory");
    const container = invComp.container;
    // Parcourt chaque slot
    for (let i = 0; i < container.size; i++) {
        /**
         * @type {ItemStack}
         */
        const stack = container.getItem(i);

        if (stack && stack.typeId === itemId && stack.amount > 0) {
            return true;
        }
    }
    return false;
}

function playerClearItem(player, itemId, count) {
    // Récupère le composant d'inventaire
    const invComp = player.getComponent("minecraft:inventory");
    const container = invComp.container;
    // Parcourt chaque slot
    for (let i = 0; i < container.size; i++) {
        /**
         * @type {ItemStack}
         */
        const stack = container.getItem(i);

        if (stack && stack.typeId === itemId && stack.amount > 0) {
            const newAmount = stack.amount - count;

            if (newAmount > 0) {
                // remplace par le même item avec -1 quantité
                container.setItem(i, new ItemStack(itemId, newAmount));
            } else {
                // supprime totalement le stack
                container.setItem(i, undefined);
            }
            return true;
        }
    }
    return false;
}

function normalizeVector3(vector) {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    if (length === 0) return { x: 0, y: 0, z: 0 };
    return {
        x: vector.x / length,
        y: vector.y / length,
        z: vector.z / length
    };
}

function addVector3(a, b) {
    return {
        x: a.x + b.x,
        y: a.y + b.y,
        z: a.z + b.z
    };
}

function multiplyVector3(vector, scalar) {
    return {
        x: vector.x * scalar,
        y: vector.y * scalar,
        z: vector.z * scalar
    };
}