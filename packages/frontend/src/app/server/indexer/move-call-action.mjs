function parseJsonValue(value) {
  if (value == null) {
    return null
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  return value
}

function shortId(value) {
  return value == null ? 'unknown' : String(value)
}

function createAddressEntity(value, kind, label = null) {
  if (typeof value !== 'string' || !/^0x[0-9a-zA-Z]+$/.test(value)) {
    return null
  }

  return {
    value,
    kind,
    label,
  }
}

function buildAction(summary, entities = []) {
  const unique = []
  const seen = new Set()

  for (const entity of entities) {
    if (!entity) {
      continue
    }

    const key = `${entity.kind}:${entity.value}:${entity.label ?? ''}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    unique.push(entity)
  }

  return {
    summary,
    entities: unique,
  }
}

function stringifyValue(value) {
  if (value == null) {
    return 'unknown'
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyValue(item)).join(', ')}]`
  }

  if (typeof value === 'object') {
    if ('objectId' in value && typeof value.objectId === 'string') {
      return shortId(value.objectId)
    }

    if ('kind' in value && value.kind === 'nested_result') {
      return `result(${value.index},${value.resultIndex})`
    }

    if ('kind' in value && value.kind === 'result') {
      return `result(${value.index})`
    }

    if ('value' in value) {
      return stringifyValue(value.value)
    }
  }

  return JSON.stringify(value)
}

function getProgrammableTransaction(rawContent) {
  return rawContent?.transaction?.data?.transaction?.kind === 'ProgrammableTransaction'
    ? rawContent.transaction.data.transaction
    : null
}

function resolveInput(input) {
  if (!input || typeof input !== 'object') {
    return null
  }

  if (input.type === 'pure') {
    return {
      kind: 'pure',
      value: input.value,
      valueType: input.valueType ?? null,
    }
  }

  if (input.type === 'object') {
    return {
      kind: 'object',
      objectId: input.objectId ?? null,
      objectType: input.objectType ?? null,
      mutable: input.mutable ?? null,
    }
  }

  return input
}

function resolveArgument(argument, inputs) {
  if (!argument || typeof argument !== 'object') {
    return null
  }

  if ('Input' in argument) {
    return resolveInput(inputs?.[argument.Input])
  }

  if ('NestedResult' in argument && Array.isArray(argument.NestedResult)) {
    return {
      kind: 'nested_result',
      index: argument.NestedResult[0],
      resultIndex: argument.NestedResult[1],
    }
  }

  if ('Result' in argument) {
    return {
      kind: 'result',
      index: argument.Result,
    }
  }

  return argument
}

function resolveArguments(rawCall, rawContent) {
  const parsedRawCall = parseJsonValue(rawCall)
  const programmableTransaction = getProgrammableTransaction(rawContent)
  const inputs = programmableTransaction?.inputs ?? []
  const argumentsList = Array.isArray(parsedRawCall?.arguments) ? parsedRawCall.arguments : []

  return argumentsList.map((argument) => resolveArgument(argument, inputs))
}

function findEvent(rawContent, suffix) {
  const events = Array.isArray(rawContent?.events) ? rawContent.events : []

  return events.find(
    (event) => typeof event?.type === 'string' && event.type.endsWith(`::${suffix}`)
  ) ?? null
}

function getPureValue(argumentsList, index) {
  const value = argumentsList[index]

  if (value && typeof value === 'object' && value.kind === 'pure') {
    return value.value
  }

  return null
}

function getObjectId(argumentsList, index) {
  const value = argumentsList[index]

  if (value && typeof value === 'object' && value.kind === 'object') {
    return value.objectId ?? null
  }

  return null
}

function describeAnchor(moduleName, args, rawContent) {
  if (moduleName === 'character') {
    const createdEvent = findEvent(rawContent, 'CharacterCreatedEvent')?.parsedJson
    const metadataEvent = findEvent(rawContent, 'MetadataChangedEvent')?.parsedJson
    const name = metadataEvent?.name ?? getPureValue(args, 6)
    const characterId = createdEvent?.character_id
    const gameCharacterId = createdEvent?.key?.item_id ?? getPureValue(args, 2)
    const tribeId = createdEvent?.tribe_id ?? getPureValue(args, 4)
    const walletAddress = createdEvent?.character_address ?? getPureValue(args, 5)

    return buildAction(
      `${name ?? 'A player'} created character ${gameCharacterId ?? 'unknown'} (tribe ${tribeId ?? 'unknown'}, wallet ${shortId(walletAddress)}, character ${shortId(characterId)}).`,
      [
        createAddressEntity(walletAddress, 'account', 'wallet'),
        createAddressEntity(characterId, 'object', 'character'),
      ]
    )
  }

  const itemId = getPureValue(args, 4)
  const typeId = getPureValue(args, 5)
  const maxCapacity = moduleName === 'storage_unit' ? getPureValue(args, 6) : null
  const noun = moduleName === 'network_node'
    ? 'network node'
    : moduleName === 'storage_unit'
      ? 'storage unit'
      : moduleName === 'gate'
        ? 'gate'
        : moduleName === 'turret'
          ? 'turret'
          : 'structure'

  if (maxCapacity != null) {
    return buildAction(`The user anchored a ${noun} (item_id ${itemId ?? 'unknown'}, type_id ${typeId ?? 'unknown'}, max_capacity ${maxCapacity}).`)
  }

  return buildAction(`The user anchored a ${noun} (item_id ${itemId ?? 'unknown'}, type_id ${typeId ?? 'unknown'}).`)
}

function describeShare(moduleName) {
  const noun = {
    character: 'character',
    assembly: 'assembly',
    network_node: 'network node',
    gate: 'gate',
    storage_unit: 'storage unit',
    turret: 'turret',
  }[moduleName] ?? 'object'

  return buildAction(`The user shared this ${noun} as an on-chain shared object.`)
}

function describeOnline(moduleName, args) {
  const objectId = getObjectId(args, 0)
  const noun = {
    assembly: 'assembly',
    network_node: 'network node',
    gate: 'gate',
    storage_unit: 'storage unit',
    turret: 'turret',
  }[moduleName] ?? 'object'

  return buildAction(
    `The user brought ${noun} ${shortId(objectId)} online and started consuming power.`,
    [createAddressEntity(objectId, 'object', noun)]
  )
}

function describeOffline(moduleName, args) {
  const objectId = getObjectId(args, 0)
  const noun = {
    assembly: 'assembly',
    network_node: 'network node',
    gate: 'gate',
    storage_unit: 'storage unit',
    turret: 'turret',
  }[moduleName] ?? 'object'

  return buildAction(
    `The user took ${noun} ${shortId(objectId)} offline and released its reserved resources.`,
    [createAddressEntity(objectId, 'object', noun)]
  )
}

function describeMetadataUpdate(moduleName, field, args) {
  const objectId = getObjectId(args, 0)
  const value = getPureValue(args, 2)
  const noun = {
    assembly: 'assembly',
    network_node: 'network node',
    gate: 'gate',
    storage_unit: 'storage unit',
    turret: 'turret',
    character: 'character',
  }[moduleName] ?? 'object'

  return buildAction(
    `The user updated the ${field} of ${noun} ${shortId(objectId)} to ${JSON.stringify(value ?? 'unknown')}.`,
    [createAddressEntity(objectId, 'object', noun)]
  )
}

function describeRevealLocation(moduleName, args, rawContent) {
  const event = findEvent(rawContent, 'LocationRevealedEvent')?.parsedJson
  const objectId = event?.assembly_id ?? getObjectId(args, 0)
  const solarsystem = event?.solarsystem ?? getPureValue(args, 3)
  const x = event?.x ?? getPureValue(args, 4)
  const y = event?.y ?? getPureValue(args, 5)
  const z = event?.z ?? getPureValue(args, 6)
  const noun = {
    network_node: 'network node',
    gate: 'gate',
    storage_unit: 'storage unit',
    turret: 'turret',
    assembly: 'assembly',
  }[moduleName] ?? 'object'

  return buildAction(
    `The user revealed the location of ${noun} ${shortId(objectId)} (solarSystem ${solarsystem}, x ${x}, y ${y}, z ${z}).`,
    [createAddressEntity(objectId, 'object', noun)]
  )
}

function describeAuthorizeExtension(moduleName, rawCall, args) {
  const parsedRawCall = parseJsonValue(rawCall)
  const extensionType = parsedRawCall?.type_arguments?.[0] ?? 'unknown extension'
  const objectId = getObjectId(args, 0)
  const noun = {
    gate: 'gate',
    storage_unit: 'storage unit',
    turret: 'turret',
  }[moduleName] ?? 'structure'

  return buildAction(
    `The user authorized extension ${extensionType} on ${noun} ${shortId(objectId)}.`,
    [createAddressEntity(objectId, 'object', noun)]
  )
}

function describeFreezeExtension(moduleName, args) {
  const objectId = getObjectId(args, 0)
  const noun = {
    gate: 'gate',
    storage_unit: 'storage unit',
    turret: 'turret',
  }[moduleName] ?? 'structure'

  return buildAction(
    `The user froze the extension configuration on ${noun} ${shortId(objectId)} so it can no longer be changed.`,
    [createAddressEntity(objectId, 'object', noun)]
  )
}

function describeUpdateEnergySource(moduleName, args) {
  const objectId = getObjectId(args, 0)
  const networkNodeId = getObjectId(args, 2)
  const noun = {
    assembly: 'assembly',
    gate: 'gate',
    storage_unit: 'storage unit',
    turret: 'turret',
  }[moduleName] ?? 'structure'

  return buildAction(
    `The user changed the power source of ${noun} ${shortId(objectId)} to network node ${shortId(networkNodeId)}.`,
    [
      createAddressEntity(objectId, 'object', noun),
      createAddressEntity(networkNodeId, 'object', 'network node'),
    ]
  )
}

function describeOfflineConnected(moduleName, args) {
  const objectId = getObjectId(args, 0)
  const noun = {
    assembly: 'assembly',
    gate: 'gate',
    storage_unit: 'storage unit',
    turret: 'turret',
  }[moduleName] ?? 'structure'

  return buildAction(
    `The system offlined connected ${noun} ${shortId(objectId)} during the network node shutdown flow.`,
    [createAddressEntity(objectId, 'object', noun)]
  )
}

function describeOfflineOrphaned(moduleName, args) {
  const objectId = getObjectId(args, 0)
  const noun = {
    assembly: 'assembly',
    gate: 'gate',
    storage_unit: 'storage unit',
    turret: 'turret',
  }[moduleName] ?? 'structure'

  return buildAction(
    `The system offlined orphaned ${noun} ${shortId(objectId)} and cleared its power source after the network node was removed.`,
    [createAddressEntity(objectId, 'object', noun)]
  )
}

function describeUnanchor(moduleName, args) {
  const objectId = getObjectId(args, 0)
  const noun = {
    assembly: 'assembly',
    gate: 'gate',
    storage_unit: 'storage unit',
    turret: 'turret',
  }[moduleName] ?? 'object'

  return buildAction(`The user unanchored ${noun} ${shortId(objectId)}.`, [
    createAddressEntity(objectId, 'object', noun),
  ])
}

function describeUnanchorOrphan(moduleName, args) {
  const objectId = getObjectId(args, 0)
  const noun = {
    assembly: 'assembly',
    gate: 'gate',
    storage_unit: 'storage unit',
    turret: 'turret',
  }[moduleName] ?? 'object'

  return buildAction(`The user unanchored orphaned ${noun} ${shortId(objectId)}.`, [
    createAddressEntity(objectId, 'object', noun),
  ])
}

function describeGameItemToChainInventory(args) {
  const itemId = getPureValue(args, 4)
  const typeId = getPureValue(args, 5)
  const volume = getPureValue(args, 6)
  const quantity = getPureValue(args, 7)

  return buildAction(`The user mapped in-game inventory to on-chain inventory (item_id ${itemId ?? 'unknown'}, type_id ${typeId ?? 'unknown'}, volume ${volume ?? 'unknown'}, quantity ${quantity ?? 'unknown'}).`)
}

function describeChainItemToGameInventory(args) {
  const typeId = getPureValue(args, 4)
  const quantity = getPureValue(args, 5)

  return buildAction(`The user consumed on-chain inventory and wrote it back to in-game inventory (type_id ${typeId ?? 'unknown'}, quantity ${quantity ?? 'unknown'}).`)
}

function describeWithdrawByOwner(args) {
  const storageUnitId = getObjectId(args, 0)
  const typeId = getPureValue(args, 3)
  const quantity = getPureValue(args, 4)

  return buildAction(
    `The user withdrew their own inventory from storage unit ${shortId(storageUnitId)} (type_id ${typeId ?? 'unknown'}, quantity ${quantity ?? 'unknown'}).`,
    [createAddressEntity(storageUnitId, 'object', 'storage unit')]
  )
}

function describeDepositByOwner(args) {
  const storageUnitId = getObjectId(args, 0)
  const itemObjectId = getObjectId(args, 1)

  return buildAction(
    `The user deposited on-chain item ${shortId(itemObjectId)} into storage unit ${shortId(storageUnitId)}.`,
    [
      createAddressEntity(itemObjectId, 'object', 'item'),
      createAddressEntity(storageUnitId, 'object', 'storage unit'),
    ]
  )
}

function describeCreateCharacter(args, rawContent) {
  return describeAnchor('character', args, rawContent)
}

function describeBorrowOwnerCap(rawCall, args) {
  const parsedRawCall = parseJsonValue(rawCall)
  const borrowedType = parsedRawCall?.type_arguments?.[0] ?? 'unknown'
  const characterId = getObjectId(args, 0)

  return buildAction(
    `The user borrowed an OwnerCap of type ${borrowedType} from character ${shortId(characterId)}.`,
    [createAddressEntity(characterId, 'object', 'character')]
  )
}

function describeReturnOwnerCap(rawCall, args) {
  const parsedRawCall = parseJsonValue(rawCall)
  const returnedType = parsedRawCall?.type_arguments?.[0] ?? 'unknown'
  const characterId = getObjectId(args, 0)

  return buildAction(
    `The user returned an OwnerCap of type ${returnedType} to character ${shortId(characterId)}.`,
    [createAddressEntity(characterId, 'object', 'character')]
  )
}

function describeReturnOwnerCapToObject(rawCall, args) {
  const parsedRawCall = parseJsonValue(rawCall)
  const returnedType = parsedRawCall?.type_arguments?.[0] ?? 'unknown'
  const ownerId = getObjectId(args, 2)

  return buildAction(
    `The system returned an OwnerCap of type ${returnedType} to object owner ${shortId(ownerId)}.`,
    [createAddressEntity(ownerId, 'object', 'owner')]
  )
}

function describeDepositFuel(args) {
  const networkNodeId = getObjectId(args, 0)
  const typeId = getPureValue(args, 3)
  const volume = getPureValue(args, 4)
  const quantity = getPureValue(args, 5)

  return buildAction(
    `The user deposited fuel into network node ${shortId(networkNodeId)} (type_id ${typeId ?? 'unknown'}, unit_volume ${volume ?? 'unknown'}, quantity ${quantity ?? 'unknown'}).`,
    [createAddressEntity(networkNodeId, 'object', 'network node')]
  )
}

function describeWithdrawFuel(args) {
  const networkNodeId = getObjectId(args, 0)
  const typeId = getPureValue(args, 3)
  const quantity = getPureValue(args, 4)

  return buildAction(
    `The user withdrew fuel from network node ${shortId(networkNodeId)} (type_id ${typeId ?? 'unknown'}, quantity ${quantity ?? 'unknown'}).`,
    [createAddressEntity(networkNodeId, 'object', 'network node')]
  )
}

function describeSetEnergyConfig(args) {
  const assemblyTypeId = getPureValue(args, 2)
  const energyRequired = getPureValue(args, 3)

  return buildAction(`An admin set the energy requirement of structure type_id ${assemblyTypeId ?? 'unknown'} to ${energyRequired ?? 'unknown'}.`)
}

function describeSetFuelEfficiency(args) {
  const fuelTypeId = getPureValue(args, 2)
  const efficiency = getPureValue(args, 3)

  return buildAction(`An admin set the efficiency of fuel type_id ${fuelTypeId ?? 'unknown'} to ${efficiency ?? 'unknown'}.`)
}

function describeJump(rawContent, permitRequired) {
  const event = findEvent(rawContent, 'JumpEvent')?.parsedJson

  if (event) {
    return buildAction(
      `Character ${shortId(event.character_id)} jumped from gate ${shortId(event.source_gate_id)} to gate ${shortId(event.destination_gate_id)}${permitRequired ? ' with a permit' : ''}.`,
      [
        createAddressEntity(event.character_id, 'object', 'character'),
        createAddressEntity(event.source_gate_id, 'object', 'source gate'),
        createAddressEntity(event.destination_gate_id, 'object', 'destination gate'),
      ]
    )
  }

  return buildAction(
    permitRequired
      ? 'The user executed a gate jump with a permit.'
      : 'The user executed a standard gate jump.'
  )
}

function describeLinkGates(rawContent) {
  const event = findEvent(rawContent, 'GateLinkedEvent')?.parsedJson

  if (event) {
    return buildAction(
      `The user linked gate ${shortId(event.source_gate_id)} to gate ${shortId(event.destination_gate_id)}.`,
      [
        createAddressEntity(event.source_gate_id, 'object', 'source gate'),
        createAddressEntity(event.destination_gate_id, 'object', 'destination gate'),
      ]
    )
  }

  return buildAction('The user linked two gates.')
}

function describeUnlinkGates(rawContent) {
  const event = findEvent(rawContent, 'GateUnlinkedEvent')?.parsedJson

  if (event) {
    return buildAction(
      `The user unlinked gate ${shortId(event.source_gate_id)} from gate ${shortId(event.destination_gate_id)}.`,
      [
        createAddressEntity(event.source_gate_id, 'object', 'source gate'),
        createAddressEntity(event.destination_gate_id, 'object', 'destination gate'),
      ]
    )
  }

  return buildAction('The user unlinked two gates.')
}

function describeSetMaxDistance(args) {
  const typeId = getPureValue(args, 2)
  const maxDistance = getPureValue(args, 3)

  return buildAction(`An admin set the maximum link distance of gate type_id ${typeId ?? 'unknown'} to ${maxDistance ?? 'unknown'}.`)
}

function describeConnectAssemblies(args) {
  const networkNodeId = getObjectId(args, 0)
  const assemblies = getPureValue(args, 2)
  const count = Array.isArray(assemblies) ? assemblies.length : null

  return count != null
    ? buildAction(`The user connected ${count} structures to network node ${shortId(networkNodeId)}.`, [
        createAddressEntity(networkNodeId, 'object', 'network node'),
      ])
    : buildAction(`The user started connecting a batch of structures to network node ${shortId(networkNodeId)}.`, [
        createAddressEntity(networkNodeId, 'object', 'network node'),
      ])
}

function describeDestroyOfflineAssemblies(rawContent) {
  const count = Array.isArray(rawContent?.transaction?.data?.transaction?.transactions)
    ? rawContent.transaction.data.transaction.transactions.filter(
        (item) =>
          item?.MoveCall?.module &&
          item.MoveCall.function &&
          item.MoveCall.function.startsWith('offline_')
      ).length
    : null

  return buildAction(
    count != null && count > 0
      ? `The system finished the offline cleanup for ${count} affected structures.`
      : 'The system finished the offline cleanup for affected structures.'
  )
}

function describeDestroyUpdateEnergySources(rawContent) {
  const count = Array.isArray(rawContent?.transaction?.data?.transaction?.transactions)
    ? rawContent.transaction.data.transaction.transactions.filter(
        (item) =>
          item?.MoveCall?.function &&
          item.MoveCall.function.startsWith('update_energy_source_connected_')
      ).length
    : null

  return buildAction(
    count != null && count > 0
      ? `The system finished the power-source update cleanup for ${count} structures.`
      : 'The system finished the power-source update cleanup for affected structures.'
  )
}

function describeDestroyNetworkNode(args) {
  const networkNodeId = getObjectId(args, 0)
  return buildAction(
    `The user destroyed network node ${shortId(networkNodeId)} after cleaning up its attached structures.`,
    [createAddressEntity(networkNodeId, 'object', 'network node')]
  )
}

function describeUpdateTribe(args) {
  const characterId = getObjectId(args, 0)
  const tribeId = getPureValue(args, 2)

  return buildAction(
    `An admin updated character ${shortId(characterId)} to tribe ${tribeId ?? 'unknown'}.`,
    [createAddressEntity(characterId, 'object', 'character')]
  )
}

function describeAddSponsorToAcl(args) {
  const sponsorAddress = getPureValue(args, 2)
  return buildAction(
    `An admin added address ${shortId(sponsorAddress)} to the sponsor allowlist.`,
    [createAddressEntity(sponsorAddress, 'account', 'sponsor')]
  )
}

function describeRegisterServerAddress(args) {
  const serverAddress = getPureValue(args, 2)
  return buildAction(
    `An admin registered trusted server address ${shortId(serverAddress)}.`,
    [createAddressEntity(serverAddress, 'account', 'server')]
  )
}

function describeUnlinkAndUnanchor(args) {
  const sourceGateId = getObjectId(args, 0)
  const destinationGateId = getObjectId(args, 1)

  return buildAction(
    `The user unlinked gate ${shortId(sourceGateId)} from gate ${shortId(destinationGateId)} and then unanchored the source gate.`,
    [
      createAddressEntity(sourceGateId, 'object', 'source gate'),
      createAddressEntity(destinationGateId, 'object', 'destination gate'),
    ]
  )
}

const GENERIC_DESCRIPTIONS = {
  offline_connected_turret: ({ moduleName, args }) => describeOfflineConnected(moduleName, args),
  destroy_offline_assemblies: ({ rawContent }) => describeDestroyOfflineAssemblies(rawContent),
  update_fuel: ({ args }) =>
    buildAction(
      `The system settled fuel consumption for network node ${shortId(getObjectId(args, 0))} and checked whether it should be powered down.`,
      [createAddressEntity(getObjectId(args, 0), 'object', 'network node')]
    ),
  offline_connected_assembly: ({ moduleName, args }) => describeOfflineConnected(moduleName, args),
  offline_connected_storage_unit: ({ moduleName, args }) => describeOfflineConnected(moduleName, args),
  offline_connected_gate: ({ moduleName, args }) => describeOfflineConnected(moduleName, args),
  borrow_owner_cap: ({ rawCall, args }) => describeBorrowOwnerCap(rawCall, args),
  return_owner_cap: ({ rawCall, args }) => describeReturnOwnerCap(rawCall, args),
  authorize_extension: ({ moduleName, rawCall, args }) =>
    describeAuthorizeExtension(moduleName, rawCall, args),
  online: ({ moduleName, args }) => describeOnline(moduleName, args),
  anchor: ({ moduleName, args, rawContent }) => describeAnchor(moduleName, args, rawContent),
  update_metadata_url: ({ moduleName, args }) => describeMetadataUpdate(moduleName, 'URL', args),
  update_metadata_name: ({ moduleName, args }) => describeMetadataUpdate(moduleName, 'name', args),
  update_metadata_description: ({ moduleName, args }) =>
    describeMetadataUpdate(moduleName, 'description', args),
  game_item_to_chain_inventory: ({ args }) => describeGameItemToChainInventory(args),
  create_character: ({ args, rawContent }) => describeCreateCharacter(args, rawContent),
  share_character: ({ moduleName }) => describeShare(moduleName),
  deposit_fuel: ({ args }) => describeDepositFuel(args),
  chain_item_to_game_inventory: ({ args }) => describeChainItemToGameInventory(args),
  offline: ({ moduleName, args }) => describeOffline(moduleName, args),
  share_network_node: ({ moduleName }) => describeShare(moduleName),
  share_assembly: ({ moduleName }) => describeShare(moduleName),
  share_gate: ({ moduleName }) => describeShare(moduleName),
  share_storage_unit: ({ moduleName }) => describeShare(moduleName),
  share_turret: ({ moduleName }) => describeShare(moduleName),
  unanchor: ({ moduleName, args }) => describeUnanchor(moduleName, args),
  offline_orphaned_assembly: ({ moduleName, args }) => describeOfflineOrphaned(moduleName, args),
  destroy_network_node: ({ args }) => describeDestroyNetworkNode(args),
  update_energy_source_connected_assembly: ({ moduleName, args }) =>
    describeUpdateEnergySource(moduleName, args),
  return_owner_cap_to_object: ({ rawCall, args }) =>
    describeReturnOwnerCapToObject(rawCall, args),
  link_gates: ({ rawContent }) => describeLinkGates(rawContent),
  offline_orphaned_storage_unit: ({ moduleName, args }) => describeOfflineOrphaned(moduleName, args),
  unanchor_orphan: ({ moduleName, args }) => describeUnanchorOrphan(moduleName, args),
  withdraw_fuel: ({ args }) => describeWithdrawFuel(args),
  reveal_location: ({ moduleName, args, rawContent }) =>
    describeRevealLocation(moduleName, args, rawContent),
  set_energy_config: ({ args }) => describeSetEnergyConfig(args),
  jump_with_permit: ({ rawContent }) => describeJump(rawContent, true),
  offline_orphaned_turret: ({ moduleName, args }) => describeOfflineOrphaned(moduleName, args),
  withdraw_by_owner: ({ args }) => describeWithdrawByOwner(args),
  update_energy_source_connected_storage_unit: ({ moduleName, args }) =>
    describeUpdateEnergySource(moduleName, args),
  unlink_gates: ({ rawContent }) => describeUnlinkGates(rawContent),
  offline_orphaned_gate: ({ moduleName, args }) => describeOfflineOrphaned(moduleName, args),
  connect_assemblies: ({ args }) => describeConnectAssemblies(args),
  destroy_update_energy_sources: ({ rawContent }) => describeDestroyUpdateEnergySources(rawContent),
  jump: ({ rawContent }) => describeJump(rawContent, false),
  set_fuel_efficiency: ({ args }) => describeSetFuelEfficiency(args),
  freeze_extension_config: ({ moduleName, args }) => describeFreezeExtension(moduleName, args),
  update_energy_source_connected_gate: ({ moduleName, args }) =>
    describeUpdateEnergySource(moduleName, args),
  add_sponsor_to_acl: ({ args }) => describeAddSponsorToAcl(args),
  deposit_by_owner: ({ args }) => describeDepositByOwner(args),
  set_max_distance: ({ args }) => describeSetMaxDistance(args),
  update_tribe: ({ args }) => describeUpdateTribe(args),
  register_server_address: ({ args }) => describeRegisterServerAddress(args),
  unlink_and_unanchor: ({ args }) => describeUnlinkAndUnanchor(args),
  update_energy_source_connected_turret: ({ moduleName, args }) =>
    describeUpdateEnergySource(moduleName, args),
}

export function describeMoveCallRichAction({
  moduleName,
  functionName,
  rawCall,
  rawContent,
}) {
  const parsedRawCall = parseJsonValue(rawCall)
  const parsedRawContent = parseJsonValue(rawContent)
  const args = resolveArguments(parsedRawCall, parsedRawContent)
  const describe = GENERIC_DESCRIPTIONS[functionName]

  if (describe) {
    return describe({
      moduleName,
      functionName,
      rawCall: parsedRawCall,
      rawContent: parsedRawContent,
      args,
    })
  }

  return buildAction(`The user called ${moduleName ?? 'unknown'}::${functionName ?? 'unknown'}.`)
}

export function describeMoveCallAction(input) {
  return describeMoveCallRichAction(input).summary
}

export function withMoveCallAction(item) {
  const {
    rawContent,
    ...rest
  } = item
  const action = describeMoveCallRichAction({
    ...rest,
    rawContent,
  })

  return {
    ...rest,
    actionSummary: action.summary,
    actionEntities: action.entities,
  }
}
