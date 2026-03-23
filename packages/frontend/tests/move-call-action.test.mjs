import test from 'node:test'
import assert from 'node:assert/strict'

import {
  describeMoveCallAction,
  withMoveCallAction,
} from '../src/app/server/indexer/move-call-action.mjs'

function buildProgrammableRawContent({ inputs = [], events = [], transactions = [] }) {
  return {
    transaction: {
      data: {
        transaction: {
          kind: 'ProgrammableTransaction',
          inputs,
          transactions,
        },
      },
    },
    events,
  }
}

test('describeMoveCallAction decodes create_character from inputs and events', () => {
  const rawCall = {
    package: '0xpackage',
    module: 'character',
    function: 'create_character',
    arguments: [
      { Input: 1 },
      { Input: 0 },
      { Input: 2 },
      { Input: 3 },
      { Input: 4 },
      { Input: 5 },
      { Input: 6 },
    ],
  }
  const rawContent = buildProgrammableRawContent({
    inputs: [
      { type: 'object', objectId: '0xadmin' },
      { type: 'object', objectId: '0xregistry' },
      { type: 'pure', value: 2112000195, valueType: 'u32' },
      { type: 'pure', value: 'utopia', valueType: '0x1::string::String' },
      { type: 'pure', value: 1000167, valueType: 'u32' },
      {
        type: 'pure',
        value: '0x3873f62c5280a2c93991321d065870bc1758783ee4f41b2cbe25f45be957677b',
        valueType: 'address',
      },
      { type: 'pure', value: 'Sir LeapsALot', valueType: '0x1::string::String' },
    ],
    events: [
      {
        type: '0xpackage::character::CharacterCreatedEvent',
        parsedJson: {
          key: { tenant: 'utopia', item_id: '2112000195' },
          tribe_id: 1000167,
          character_id: '0xe7d8aea0108b865a172476cd033a356e61e1daf1f71300a03fc73ee8a7611437',
          character_address:
            '0x3873f62c5280a2c93991321d065870bc1758783ee4f41b2cbe25f45be957677b',
        },
      },
      {
        type: '0xpackage::metadata::MetadataChangedEvent',
        parsedJson: {
          name: 'Sir LeapsALot',
        },
      },
    ],
  })

  const summary = describeMoveCallAction({
    moduleName: 'character',
    functionName: 'create_character',
    rawCall,
    rawContent,
  })

  assert.match(summary, /Sir LeapsALot/)
  assert.match(summary, /2112000195/)
  assert.match(summary, /1000167/)
})

test('describeMoveCallAction decodes withdraw_by_owner type and quantity', () => {
  const summary = describeMoveCallAction({
    moduleName: 'storage_unit',
    functionName: 'withdraw_by_owner',
    rawCall: {
      package: '0xpackage',
      module: 'storage_unit',
      function: 'withdraw_by_owner',
      type_arguments: ['0xpackage::character::Character'],
      arguments: [{ Input: 2 }, { Input: 0 }, { NestedResult: [0, 0] }, { Input: 3 }, { Input: 4 }],
    },
    rawContent: buildProgrammableRawContent({
      inputs: [
        { type: 'object', objectId: '0xcharacter' },
        { type: 'object', objectId: '0xreceiving' },
        { type: 'object', objectId: '0xstorage' },
        { type: 'pure', value: '92389', valueType: 'u64' },
        { type: 'pure', value: 1, valueType: 'u32' },
      ],
    }),
  })

  assert.match(summary, /0xstorage/)
  assert.match(summary, /92389/)
  assert.match(summary, /quantity 1/)
})

test('describeMoveCallAction decodes reveal_location coordinates from event', () => {
  const summary = describeMoveCallAction({
    moduleName: 'gate',
    functionName: 'reveal_location',
    rawCall: {
      package: '0xpackage',
      module: 'gate',
      function: 'reveal_location',
      arguments: [{ Input: 0 }, { Input: 1 }, { Input: 2 }, { Input: 3 }, { Input: 4 }, { Input: 5 }, { Input: 6 }],
    },
    rawContent: buildProgrammableRawContent({
      inputs: [
        { type: 'object', objectId: '0xgate' },
        { type: 'object', objectId: '0xregistry' },
        { type: 'object', objectId: '0xadmin' },
        { type: 'pure', value: '30013131', valueType: 'u64' },
        { type: 'pure', value: '-13603813699033432000', valueType: '0x1::string::String' },
        { type: 'pure', value: '1701341156251967500', valueType: '0x1::string::String' },
        { type: 'pure', value: '-992652798509291600', valueType: '0x1::string::String' },
      ],
      events: [
        {
          type: '0xpackage::location::LocationRevealedEvent',
          parsedJson: {
            assembly_id: '0x4e3eb175c4bac0edf3509b8681bf97d6439fc17bd462422f305f3db07599c36c',
            solarsystem: '30013131',
            x: '-13603813699033432000',
            y: '1701341156251967500',
            z: '-992652798509291600',
          },
        },
      ],
    }),
  })

  assert.match(summary, /revealed the location of gate/)
  assert.match(
    summary,
    /0x4e3eb175c4bac0edf3509b8681bf97d6439fc17bd462422f305f3db07599c36c/
  )
  assert.match(summary, /30013131/)
  assert.match(summary, /-13603813699033432000/)
})

test('describeMoveCallAction decodes jump_with_permit from JumpEvent', () => {
  const summary = describeMoveCallAction({
    moduleName: 'gate',
    functionName: 'jump_with_permit',
    rawCall: {
      package: '0xpackage',
      module: 'gate',
      function: 'jump_with_permit',
      arguments: [{ Input: 0 }, { Input: 1 }, { Input: 2 }, { Input: 3 }, { Input: 4 }, { Input: 5 }],
    },
    rawContent: buildProgrammableRawContent({
      events: [
        {
          type: '0xpackage::gate::JumpEvent',
          parsedJson: {
            character_id: '0x9162fb775028fb0ea0479d8e6187040403d1a7388b2abda3c19aab1539893110',
            source_gate_id: '0xb7007baf5045eb43a663b29f54636148124c5565ed96741192ad987fc66df220',
            destination_gate_id: '0xf13071441b28507485782c8bf4f45c5596f2d0e14230ad9f684d8e76da311b68',
          },
        },
      ],
    }),
  })

  assert.match(summary, /with a permit/)
  assert.match(
    summary,
    /0xb7007baf5045eb43a663b29f54636148124c5565ed96741192ad987fc66df220/
  )
  assert.match(
    summary,
    /0xf13071441b28507485782c8bf4f45c5596f2d0e14230ad9f684d8e76da311b68/
  )
})

test('describeMoveCallAction decodes authorize_extension type argument', () => {
  const summary = describeMoveCallAction({
    moduleName: 'turret',
    functionName: 'authorize_extension',
    rawCall: {
      package: '0xpackage',
      module: 'turret',
      function: 'authorize_extension',
      type_arguments: ['0xext::turret::DefenseAuth'],
      arguments: [{ Input: 0 }, { NestedResult: [1, 0] }],
    },
    rawContent: buildProgrammableRawContent({
      inputs: [{ type: 'object', objectId: '0xturret' }],
    }),
  })

  assert.match(summary, /DefenseAuth/)
  assert.match(summary, /0xturret/)
})

test('describeMoveCallAction decodes set_energy_config values', () => {
  const summary = describeMoveCallAction({
    moduleName: 'energy',
    functionName: 'set_energy_config',
    rawCall: {
      package: '0xpackage',
      module: 'energy',
      function: 'set_energy_config',
      arguments: [{ Input: 0 }, { Input: 1 }, { Input: 2 }, { Input: 3 }],
    },
    rawContent: buildProgrammableRawContent({
      inputs: [
        { type: 'object', objectId: '0xenergy-config' },
        { type: 'object', objectId: '0xadmin' },
        { type: 'pure', value: 88092, valueType: 'u64' },
        { type: 'pure', value: 25, valueType: 'u64' },
      ],
    }),
  })

  assert.equal(
    summary,
    'An admin set the energy requirement of structure type_id 88092 to 25.'
  )
})

test('withMoveCallAction decorates move calls with actionSummary', () => {
  const item = withMoveCallAction({
    moduleName: 'storage_unit',
    functionName: 'deposit_by_owner',
    rawCall: {
      package: '0xpackage',
      module: 'storage_unit',
      function: 'deposit_by_owner',
      arguments: [{ Input: 0 }, { Input: 1 }, { Input: 2 }, { NestedResult: [0, 0] }],
    },
    rawContent: buildProgrammableRawContent({
      inputs: [
        { type: 'object', objectId: '0xstorage' },
        { type: 'object', objectId: '0xitem' },
        { type: 'object', objectId: '0xcharacter' },
      ],
    }),
  })

  assert.equal(typeof item.actionSummary, 'string')
  assert.match(item.actionSummary, /0xitem/)
  assert.match(item.actionSummary, /0xstorage/)
  assert.deepEqual(item.actionEntities, [
    {
      value: '0xitem',
      kind: 'object',
      label: 'item',
    },
    {
      value: '0xstorage',
      kind: 'object',
      label: 'storage unit',
    },
  ])
})

test('withMoveCallAction classifies update_fuel network node as object', () => {
  const item = withMoveCallAction({
    moduleName: 'network_node',
    functionName: 'update_fuel',
    rawCall: {
      package: '0xpackage',
      module: 'network_node',
      function: 'update_fuel',
      arguments: [{ Input: 0 }],
    },
    rawContent: buildProgrammableRawContent({
      inputs: [{ type: 'object', objectId: '0xde534efeedc80ce1e975c1a32d32082d58ab3e70101760c8047e5baac041957' }],
    }),
  })

  assert.equal(
    item.actionSummary,
    'The system settled fuel consumption for network node 0xde534efeedc80ce1e975c1a32d32082d58ab3e70101760c8047e5baac041957 and checked whether it should be powered down.'
  )
  assert.deepEqual(item.actionEntities, [
    {
      value: '0xde534efeedc80ce1e975c1a32d32082d58ab3e70101760c8047e5baac041957',
      kind: 'object',
      label: 'network node',
    },
  ])
})

test('every tracked function name returns a non-empty description', () => {
  const functionNames = [
    'offline_connected_turret',
    'destroy_offline_assemblies',
    'update_fuel',
    'offline_connected_assembly',
    'offline_connected_storage_unit',
    'offline_connected_gate',
    'borrow_owner_cap',
    'return_owner_cap',
    'authorize_extension',
    'online',
    'anchor',
    'update_metadata_url',
    'update_metadata_name',
    'update_metadata_description',
    'game_item_to_chain_inventory',
    'create_character',
    'share_character',
    'deposit_fuel',
    'chain_item_to_game_inventory',
    'offline',
    'share_network_node',
    'share_assembly',
    'share_gate',
    'share_storage_unit',
    'share_turret',
    'unanchor',
    'offline_orphaned_assembly',
    'destroy_network_node',
    'update_energy_source_connected_assembly',
    'return_owner_cap_to_object',
    'link_gates',
    'offline_orphaned_storage_unit',
    'unanchor_orphan',
    'withdraw_fuel',
    'reveal_location',
    'set_energy_config',
    'jump_with_permit',
    'offline_orphaned_turret',
    'withdraw_by_owner',
    'update_energy_source_connected_storage_unit',
    'unlink_gates',
    'offline_orphaned_gate',
    'connect_assemblies',
    'destroy_update_energy_sources',
    'jump',
    'set_fuel_efficiency',
    'freeze_extension_config',
    'update_energy_source_connected_gate',
    'add_sponsor_to_acl',
    'deposit_by_owner',
    'set_max_distance',
    'update_tribe',
    'register_server_address',
    'unlink_and_unanchor',
    'update_energy_source_connected_turret',
  ]

  for (const functionName of functionNames) {
    const summary = describeMoveCallAction({
      moduleName: 'test_module',
      functionName,
      rawCall: {
        package: '0xpackage',
        module: 'test_module',
        function: functionName,
        arguments: [],
      },
      rawContent: null,
    })

    assert.equal(typeof summary, 'string')
    assert.notEqual(summary.length, 0)
  }
})
