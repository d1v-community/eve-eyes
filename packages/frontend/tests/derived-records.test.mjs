import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildResolutionError,
  extractCharacterCreatedSnapshots,
  extractCharacterIdentitySnapshot,
  extractCharacterObjectChanges,
  extractKillmailEvents,
  resolveSourceTimestamp,
  unixSecondsToIso,
} from '../../indexer/src/derived-records.mjs'

const PACKAGE_ID =
  '0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75'

test('extractCharacterObjectChanges keeps only character create, mutate, and delete changes', () => {
  const changes = extractCharacterObjectChanges(
    [
      {
        type: 'created',
        objectType: `${PACKAGE_ID}::character::Character`,
        objectId:
          '0xe1c4cd5eb84c8c4daa3d28a92efbbaa635b6982fc3a68cafa29df947a7295969',
        version: '800555719',
      },
      {
        type: 'mutated',
        objectType: `${PACKAGE_ID}::character::Character`,
        objectId:
          '0xa289c829cf754f6fb661034bb594d055efa26c3c77f74bf97bd4c6848c5a9761',
        version: '801643746',
      },
      {
        type: 'deleted',
        objectType: `${PACKAGE_ID}::character::Character`,
        objectId:
          '0x583ac6793e2b6cf0446687809f4f3849505f11122fd94f9aebe517c9ff6355a4',
      },
      {
        type: 'created',
        objectType: `${PACKAGE_ID}::killmail::Killmail`,
        objectId:
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        version: '1',
      },
    ],
    PACKAGE_ID
  )

  assert.deepEqual(changes, [
    {
      kind: 'upsert',
      objectId:
        '0xe1c4cd5eb84c8c4daa3d28a92efbbaa635b6982fc3a68cafa29df947a7295969',
      version: '800555719',
    },
    {
      kind: 'upsert',
      objectId:
        '0xa289c829cf754f6fb661034bb594d055efa26c3c77f74bf97bd4c6848c5a9761',
      version: '801643746',
    },
    {
      kind: 'delete',
      objectId:
        '0x583ac6793e2b6cf0446687809f4f3849505f11122fd94f9aebe517c9ff6355a4',
      version: null,
    },
  ])
})

test('extractCharacterCreatedSnapshots builds character identity rows from create events', () => {
  const snapshots = extractCharacterCreatedSnapshots(
    [
      {
        type: `${PACKAGE_ID}::character::CharacterCreatedEvent`,
        parsedJson: {
          key: {
            item_id: '2112000175',
            tenant: 'utopia',
          },
          character_id:
            '0xe1c4cd5eb84c8c4daa3d28a92efbbaa635b6982fc3a68cafa29df947a7295969',
          character_address:
            '0x878f69675663279773b986f222152098929532b74c1b01e357d4a9b303c48b56',
        },
      },
    ],
    [
      {
        type: 'created',
        objectType: `${PACKAGE_ID}::character::Character`,
        objectId:
          '0xe1c4cd5eb84c8c4daa3d28a92efbbaa635b6982fc3a68cafa29df947a7295969',
        version: '800555719',
      },
    ],
    null,
    PACKAGE_ID
  )

  assert.deepEqual(snapshots, [
    {
      tenant: 'utopia',
      characterItemId: '2112000175',
      characterObjectId:
        '0xe1c4cd5eb84c8c4daa3d28a92efbbaa635b6982fc3a68cafa29df947a7295969',
      characterAddress:
        '0x878f69675663279773b986f222152098929532b74c1b01e357d4a9b303c48b56',
      sourceObjectVersion: '800555719',
    },
  ])
})

test('extractCharacterCreatedSnapshots falls back to effects.created when object_changes are missing', () => {
  const snapshots = extractCharacterCreatedSnapshots(
    [
      {
        type: `${PACKAGE_ID}::character::CharacterCreatedEvent`,
        parsedJson: {
          key: {
            item_id: '2112000112',
            tenant: 'utopia',
          },
          character_id:
            '0x93a582616321ac92a4baf4923214af1302e4482818a543796b744e78e80f5ec7',
          character_address:
            '0x434ce08a2396c37d060fa2c858541bf461743de7204497ddb3ac1cdf9682ed65',
        },
      },
    ],
    [],
    {
      created: [
        {
          owner: {
            Shared: {
              initial_shared_version: 794039324,
            },
          },
          reference: {
            objectId:
              '0x93a582616321ac92a4baf4923214af1302e4482818a543796b744e78e80f5ec7',
            version: 794039324,
          },
        },
      ],
    },
    PACKAGE_ID
  )

  assert.deepEqual(snapshots, [
    {
      tenant: 'utopia',
      characterItemId: '2112000112',
      characterObjectId:
        '0x93a582616321ac92a4baf4923214af1302e4482818a543796b744e78e80f5ec7',
      characterAddress:
        '0x434ce08a2396c37d060fa2c858541bf461743de7204497ddb3ac1cdf9682ed65',
      sourceObjectVersion: '794039324',
    },
  ])
})

test('extractCharacterIdentitySnapshot parses tenant, item id, object id, and wallet', () => {
  const snapshot = extractCharacterIdentitySnapshot(
    {
      status: 'VersionFound',
      details: {
        objectId:
          '0xe1c4cd5eb84c8c4daa3d28a92efbbaa635b6982fc3a68cafa29df947a7295969',
        version: '800555719',
        type: `${PACKAGE_ID}::character::Character`,
        content: {
          fields: {
            id: {
              id: '0xe1c4cd5eb84c8c4daa3d28a92efbbaa635b6982fc3a68cafa29df947a7295969',
            },
            character_address:
              '0x878f69675663279773b986f222152098929532b74c1b01e357d4a9b303c48b56',
            key: {
              fields: {
                item_id: '2112000175',
                tenant: 'utopia',
              },
            },
          },
        },
      },
    },
    PACKAGE_ID
  )

  assert.deepEqual(snapshot, {
    tenant: 'utopia',
    characterItemId: '2112000175',
    characterObjectId:
      '0xe1c4cd5eb84c8c4daa3d28a92efbbaa635b6982fc3a68cafa29df947a7295969',
    characterAddress:
      '0x878f69675663279773b986f222152098929532b74c1b01e357d4a9b303c48b56',
    sourceObjectVersion: '800555719',
  })
})

test('extractKillmailEvents parses the killmail ids and timestamps needed for later resolution', () => {
  const events = extractKillmailEvents(
    [
      {
        id: {
          txDigest: '4ZDyQjiojQQmvhpZurSyj9gT6HQoJyKYbKK1FbZKHHqY',
          eventSeq: '0',
        },
        type: `${PACKAGE_ID}::killmail::KillmailCreatedEvent`,
        parsedJson: {
          key: {
            item_id: '11',
            tenant: 'utopia',
          },
          kill_timestamp: '1774426597',
          killer_id: {
            item_id: '2112000175',
            tenant: 'utopia',
          },
          victim_id: {
            item_id: '2112000187',
            tenant: 'utopia',
          },
          reported_by_character_id: {
            item_id: '2112000175',
            tenant: 'utopia',
          },
          solar_system_id: {
            item_id: '30013131',
            tenant: 'utopia',
          },
          loss_type: {
            variant: 'SHIP',
            fields: {},
          },
        },
      },
    ],
    PACKAGE_ID
  )

  assert.deepEqual(events, [
    {
      tenant: 'utopia',
      killmailItemId: '11',
      killerCharacterItemId: '2112000175',
      victimCharacterItemId: '2112000187',
      reportedByCharacterItemId: '2112000175',
      solarSystemId: '30013131',
      eventSeq: '0',
      killTimestampUnix: '1774426597',
      killTimestamp: '2026-03-25T08:16:37.000Z',
      lossType: 'SHIP',
      rawEvent: {
        id: {
          txDigest: '4ZDyQjiojQQmvhpZurSyj9gT6HQoJyKYbKK1FbZKHHqY',
          eventSeq: '0',
        },
        type: `${PACKAGE_ID}::killmail::KillmailCreatedEvent`,
        parsedJson: {
          key: {
            item_id: '11',
            tenant: 'utopia',
          },
          kill_timestamp: '1774426597',
          killer_id: {
            item_id: '2112000175',
            tenant: 'utopia',
          },
          victim_id: {
            item_id: '2112000187',
            tenant: 'utopia',
          },
          reported_by_character_id: {
            item_id: '2112000175',
            tenant: 'utopia',
          },
          solar_system_id: {
            item_id: '30013131',
            tenant: 'utopia',
          },
          loss_type: {
            variant: 'SHIP',
            fields: {},
          },
        },
      },
    },
  ])
})

test('resolveSourceTimestamp prefers transaction_time and falls back to created_at', () => {
  assert.equal(
    resolveSourceTimestamp({
      transaction_time: '2026-03-25T13:10:18.113Z',
      created_at: '2026-03-25T13:10:19.000Z',
    }),
    '2026-03-25T13:10:18.113Z'
  )

  assert.equal(
    resolveSourceTimestamp({
      created_at: '2026-03-25T13:10:19.000Z',
    }),
    '2026-03-25T13:10:19.000Z'
  )
})

test('unixSecondsToIso converts unix seconds safely', () => {
  assert.equal(unixSecondsToIso('1774426597'), '2026-03-25T08:16:37.000Z')
  assert.equal(unixSecondsToIso('not-a-number'), null)
})

test('buildResolutionError reports exactly which identities are still missing', () => {
  assert.equal(
    buildResolutionError({
      killerWalletAddress: null,
      victimWalletAddress: '0xvictim',
      reportedByWalletAddress: null,
    }),
    'Missing character identity for killer, reported_by'
  )

  assert.equal(
    buildResolutionError({
      killerWalletAddress: '0xkiller',
      victimWalletAddress: '0xvictim',
      reportedByWalletAddress: '0xreporter',
    }),
    null
  )
})
