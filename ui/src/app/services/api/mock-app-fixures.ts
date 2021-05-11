import { ServerStatus } from 'src/app/models/patch-db/data-model'
import { PackagePropertiesVersionedData } from 'src/app/util/properties.util'
import { RR } from './api-types'

export module Mock {

  export const DbDump: RR.GetDumpRes = {
    id: 1,
    expireId: null,
    value: {
      'server-info': {
        id: 'start9-abcdefgh',
        version: '1.0.0',
        status: ServerStatus.Running,
        'lan-address': 'start9-abcdefgh.local',
        'tor-address': 'myveryownspecialtoraddress.onion',
        wifi: {
          selected: 'Goosers5G',
          connected: 'Goosers5G',
        },

        registry: 'beta-registry.start9labs.com',
        'unread-notification-count': 4,

      },
      'package-data': { },
      ui: {
        name: 'My Embassy',
        'welcome-ack': '1.0.0',
        'auto-check-updates': true,
      },
    },
  }

  export const Notifications: RR.GetNotificationsRes = [
    {
      id: '123e4567-e89b-12d3-a456-426655440000',
      'package-id': 'bitcoind',
      createdAt: '2019-12-26T14:20:30.872Z',
      code: '101',
      title: 'Install Complete',
      message: 'Installation of bitcoind has completed successfully.',
    },
    {
      id: '123e4567-e89b-12d3-a456-426655440001',
      'package-id': 'bitcoind',
      createdAt: '2019-12-26T14:20:30.872Z',
      code: '201',
      title: 'SSH Key Added',
      message: 'A new SSH key was added. If you did not do this, shit is bad.',
    },
    {
      id: '123e4567-e89b-12d3-a456-426655440002',
      'package-id': 'bitcoind',
      createdAt: '2019-12-26T14:20:30.872Z',
      code: '002',
      title: 'SSH Key Removed',
      message: 'A SSH key was removed.',
    },
    {
      id: '123e4567-e89b-12d3-a456-426655440003',
      'package-id': 'bitcoind',
      createdAt: '2019-12-26T14:20:30.872Z',
      code: '310',
      title: 'App Crashed',
      message: 'Bitcoind has crashed',
    },
  ]

  export const ServerMetrics: RR.GetServerMetricsRes = {
    'Group1': {
      'Metric1': {
        value: 22.2,
        unit: 'mi/b',
      },
      'Metric2': {
        value: 50,
        unit: '%',
      },
      'Metric3': {
        value: 10.1,
        unit: '%',
      },
    },
    'Group2': {
      'Hmmmm1': {
        value: 22.2,
        unit: 'mi/b',
      },
      'Hmmmm2': {
        value: 50,
        unit: '%',
      },
      'Hmmmm3': {
        value: 10.1,
        unit: '%',
      },
    },
  }

  export const ServerLogs: RR.GetServerLogsRes = [
    {
      timestamp: '2019-12-26T14:20:30.872Z',
      log: '****** START *****',
    },
    {
      timestamp: '2019-12-26T14:21:30.872Z',
      log: 'ServerLogs ServerLogs ServerLogs ServerLogs ServerLogs',
    },
    {
      timestamp: '2019-12-26T14:22:30.872Z',
      log: '****** FINISH *****',
    },
  ]

  export const PackageLogs: RR.GetPackageLogsRes = [
    {
      timestamp: '2019-12-26T14:20:30.872Z',
      log: '****** START *****',
    },
    {
      timestamp: '2019-12-26T14:21:30.872Z',
      log: 'ServerLogs ServerLogs ServerLogs ServerLogs ServerLogs',
    },
    {
      timestamp: '2019-12-26T14:22:30.872Z',
      log: '****** FINISH *****',
    },
  ]

  export const WiFi: RR.GetWifiRes = {
    ssids: ['Goosers', 'Goosers5G'],
    current: 'Goosers5G',
  }

  export const SshKeys: RR.GetSSHKeysRes = {
    '28:d2:7e:78:61:b4:bf:g2:de:24:15:96:4e:d4:15:53': {
      alg: 'ed25519',
      pubkey: 'VeryLongSSHPublicKey',
      hostname: 'Matt Key',
    },
    '12:f8:7e:78:61:b4:bf:e2:de:24:15:96:4e:d4:72:53': {
      alg: 'ed25519',
      pubkey: 'VeryLongSSHPublicKey',
      hostname: 'Aiden Key',
    },
  }

  export const Disks: RR.GetDisksRes = {
    '/dev/sda': {
      size: '32GB',
      description: 'Samsung',
      partitions: {
        'sdba2': {
          size: null,
          'is-mounted': false,
          label: 'Matt Stuff',
        },
      },
    },
    '/dev/sba': {
      size: '64GB',
      description: 'small USB stick',
      partitions: {
        'sdba2': {
          size: '16GB',
          'is-mounted': true,
          label: null,
        },
      },
    },
    '/dev/sbd': {
      size: '128GB',
      description: 'large USB stick',
      partitions: {
        'sdba1': {
          size: '32GB',
          'is-mounted': false,
          label: 'Partition 1',
        },
        'sdba2': {
          size: null,
          'is-mounted': true,
          label: 'Partition 2',
        },
      },
    },
  }

  export const PackageProperties: RR.GetPackagePropertiesRes = {
    version: 2,
    data: {
      'Test': {
        type: 'string',
        description: 'This is some information about the thing.',
        copyable: true,
        qr: true,
        masked: false,
        value: 'lndconnect://udlyfq2mxa4355pt7cqlrdipnvk2tsl4jtsdw7zaeekenufwcev2wlad.onion:10009?cert=MIICJTCCAcugAwIBAgIRAOyq85fqAiA3U3xOnwhH678wCgYIKoZIzj0EAwIwODEfMB0GAkUEChMWbG5kIGF1dG9nZW5lcmF0ZWQgY2VydDEVMBMGA1UEAxMMNTc0OTkwMzIyYzZlMB4XDTIwMTAyNjA3MzEyN1oXDTIxMTIyMTA3MzEyN1owODEfMB0GA1UEChMWbG5kIGF1dG9nZW5lcmF0ZWQgY2VydDEVMBMGA1UEAxMMNTc0OTkwMzIyYzZlMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEKqfhAMMZdY-eFnU5P4bGrQTSx0lo7m8u4V0yYkzUM6jlql_u31_mU2ovLTj56wnZApkEjoPl6fL2yasZA2wiy6OBtTCBsjAOBgNVHQ8BAf8EBAMCAqQwEwYDVR0lBAwwCgYIKwYBBQUHAwEwDwYDVR0TAQH_BAUwAwEB_zAdBgNVHQ4EFgQUYQ9uIO6spltnVCx4rLFL5BvBF9IwWwYDVR0RBFQwUoIMNTc0OTkwMzIyYzZlgglsb2NhbGhvc3SCBHVuaXiCCnVuaXhwYWNrZXSCB2J1ZmNvbm6HBH8AAAGHEAAAAAAAAAAAAAAAAAAAAAGHBKwSAAswCgYIKoZIzj0EAwIDSAAwRQIgVZH2Z2KlyAVY2Q2aIQl0nsvN-OEN49wreFwiBqlxNj4CIQD5_JbpuBFJuf81I5J0FQPtXY-4RppWOPZBb-y6-rkIUQ&macaroon=AgEDbG5kAusBAwoQuA8OUMeQ8Fr2h-f65OdXdRIBMBoWCgdhZGRyZXNzEgRyZWFkEgV3cml0ZRoTCgRpbmZvEgRyZWFkEgV3cml0ZRoXCghpbnZvaWNlcxIEcmVhZBIFd3JpdGUaFAoIbWFjYXJvb24SCGdlbmVyYXRlGhYKB21lc3NhZ2USBHJlYWQSBXdyaXRlGhcKCG9mZmNoYWluEgRyZWFkEgV3cml0ZRoWCgdvbmNoYWluEgRyZWFkEgV3cml0ZRoUCgVwZWVycxIEcmVhZBIFd3JpdGUaGAoGc2lnbmVyEghnZW5lcmF0ZRIEcmVhZAAABiCYsRUoUWuAHAiCSLbBR7b_qULDSl64R8LIU2aqNIyQfA',
      },
      'Nested': {
        type: 'object',
        description: 'This is a nested thing metric',
        value: {
          'Last Name': {
            type: 'string',
            description: 'The last name of the user',
            copyable: true,
            qr: true,
            masked: false,
            value: 'Hill',
          },
          'Age': {
            type: 'string',
            description: 'The age of the user',
            copyable: false,
            qr: false,
            masked: false,
            value: '35',
          },
          'Password': {
            type: 'string',
            description: 'A secret password',
            copyable: true,
            qr: false,
            masked: true,
            value: 'password123',
          },
        },
      },
      'Another Property': {
        type: 'string',
        description: 'Some more information about the service.',
        copyable: false,
        qr: true,
        masked: false,
        value: 'https://guessagain.com',
      },
    },
  } as any // @TODO why is this necessary?

  export const PackageConfig: RR.GetPackageConfigRes = {
    // config spec
    spec: {
      'testnet': {
        'name': 'Testnet',
        'type': 'boolean',
        'description': 'determines whether your node is running on testnet or mainnet',
        'changeWarning': 'Chain will have to resync!',
        'default': false,
      },
      'objectList': {
        'name': 'Object List',
        'type': 'list',
        'subtype': 'object',
        'description': 'This is a list of objects, like users or something',
        'range': '[0,4]',
        'default': [
          {
            'firstName': 'Admin',
            'lastName': 'User',
            'age': 40,
          },
          {
            'firstName': 'Admin2',
            'lastName': 'User',
            'age': 40,
          },
        ],
        // the outer spec here, at the list level, says that what's inside (the inner spec) pertains to its inner elements.
        // it just so happens that ValueSpecObject's have the field { spec: ConfigSpec }
        // see 'unionList' below for a different example.
        'spec': {
          'uniqueBy': 'lastName',
          'displayAs': `I'm {{lastName}}, {{firstName}} {{lastName}}`,
          'spec': {
            'firstName': {
              'name': 'First Name',
              'type': 'string',
              'description': 'User first name',
              'nullable': true,
              'default': null,
              'masked': false,
              'copyable': false,
            },
            'lastName': {
              'name': 'Last Name',
              'type': 'string',
              'description': 'User first name',
              'nullable': true,
              'default': {
                'charset': 'a-g,2-9',
                'len': 12,
              },
              'pattern': '^[a-zA-Z]+$',
              'patternDescription': 'must contain only letters.',
              'masked': false,
              'copyable': true,
            },
            'age': {
              'name': 'Age',
              'type': 'number',
              'description': 'The age of the user',
              'nullable': true,
              'default': null,
              'integral': false,
              'changeWarning': 'User must be at least 18.',
              'range': '[18,*)',
            },
          },
        },
      },
      'unionList': {
        'name': 'Union List',
        'type': 'list',
        'subtype': 'union',
        'description': 'This is a sample list of unions',
        'changeWarning': 'If you change this, things may work.',
        // a list of union selections. e.g. 'summer', 'winter',...
        'default': [
          'summer',
        ],
        'range': '[0, 2]',
        'spec': {
            'tag': {
              'id': 'preference',
              'name': 'Preferences',
              'variantNames': {
                'summer': 'Summer',
                'winter': 'Winter',
                'other': 'Other',
              },
            },
            // this default is used to make a union selection when a new list element is first created
            'default': 'summer',
            'variants': {
                'summer': {
                  'favorite-tree': {
                    'name': 'Favorite Tree',
                    'type': 'string',
                    'nullable': false,
                    'description': 'What is your favorite tree?',
                    'default': 'Maple',
                    'masked': false,
                    'copyable': false,
                  },
                  'favorite-flower': {
                    'name': 'Favorite Flower',
                    'type': 'enum',
                    'description': 'Select your favorite flower',
                    'valueNames': {
                      'none': 'Hate Flowers',
                      'red': 'Red',
                      'blue': 'Blue',
                      'purple': 'Purple',
                    },
                    'values': [
                      'none',
                      'red',
                      'blue',
                      'purple',
                    ],
                    'default': 'none',
                  },
                },
                'winter': {
                  'like-snow': {
                    'name': 'Like Snow?',
                    'type': 'boolean',
                    'description': 'Do you like snow or not?',
                    'default': true,
                  },
                },
          },
          'uniqueBy': 'preference',
        },
      },
      'randomEnum': {
        'name': 'Random Enum',
        'type': 'enum',
        'valueNames': {
          'null': 'Null',
          'option1': 'One 1',
          'option2': 'Two 2',
          'option3': 'Three 3',
        },
        'default': 'null',
        'description': 'This is not even real.',
        'changeWarning': 'Be careful chnaging this!',
        'values': [
          'null',
          'option1',
          'option2',
          'option3',
        ],
      },
      'favoriteNumber': {
        'name': 'Favorite Number',
        'type': 'number',
        'integral': false,
        'description': 'Your favorite number of all time',
        'changeWarning': 'Once you set this number, it can never be changed without severe consequences.',
        'nullable': false,
        'default': 7,
        'range': '(-100,100]',
        'units': 'BTC',
      },
      'secondaryNumbers': {
        'name': 'Unlucky Numbers',
        'type': 'list',
        'subtype': 'number',
        'description': 'Numbers that you like but are not your top favorite.',
        'spec': {
          'integral': false,
          'range': '[-100,200)',
        },
        'range': '[0,10]',
        'default': [
          2,
          3,
        ],
      },
      'rpcsettings': {
        'name': 'RPC Settings',
        'type': 'object',
        'uniqueBy': null,
        'description': 'rpc username and password',
        'changeWarning': 'Adding RPC users gives them special permissions on your node.',
        'nullable': false,
        'nullByDefault': false,
        'spec': {
          'laws': {
            'name': 'Laws',
            'type': 'object',
            'uniqueBy': 'law1',
            'description': 'the law of the realm',
            'nullable': true,
            'nullByDefault': true,
            'spec': {
              'law1': {
                'name': 'First Law',
                'type': 'string',
                'description': 'the first law',
                'nullable': true,
                'masked': false,
                'copyable': true,
              },
              'law2': {
                'name': 'Second Law',
                'type': 'string',
                'description': 'the second law',
                'nullable': true,
                'masked': false,
                'copyable': true,
              },
            },
          },
          'rulemakers': {
            'name': 'Rule Makers',
            'type': 'list',
            'subtype': 'object',
            'description': 'the people who make the rules',
            'range': '[0,2]',
            'default': [],
            'spec': {
              'uniqueBy': null,
              'spec': {
                'rulemakername': {
                  'name': 'Rulemaker Name',
                  'type': 'string',
                  'description': 'the name of the rule maker',
                  'nullable': false,
                  'default': {
                    'charset': 'a-g,2-9',
                    'len': 12,
                  },
                  'masked': false,
                  'copyable': false,
                },
                'rulemakerip': {
                  'name': 'Rulemaker IP',
                  'type': 'string',
                  'description': 'the ip of the rule maker',
                  'nullable': false,
                  'default': '192.168.1.0',
                  'pattern': '^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$',
                  'patternDescription': 'may only contain numbers and periods',
                  'masked': false,
                  'copyable': true,
                },
              },
            },
          },
          'rpcuser': {
            'name': 'RPC Username',
            'type': 'string',
            'description': 'rpc username',
            'nullable': false,
            'default': 'defaultrpcusername',
            'pattern': '^[a-zA-Z]+$',
            'patternDescription': 'must contain only letters.',
            'masked': false,
            'copyable': true,
          },
          'rpcpass': {
            'name': 'RPC User Password',
            'type': 'string',
            'description': 'rpc password',
            'nullable': false,
            'default': {
              'charset': 'a-z,A-Z,2-9',
              'len': 20,
            },
            'masked': true,
            'copyable': true,
          },
        },
      },
      'advanced': {
        'name': 'Advanced',
        'type': 'object',
        'uniqueBy': null,
        'description': 'Advanced settings',
        'nullable': false,
        'nullByDefault': false,
        'spec': {
          'notifications': {
            'name': 'Notification Preferences',
            'type': 'list',
            'subtype': 'enum',
            'description': 'how you want to be notified',
            'range': '[1,3]',
            'default': [
              'email',
            ],
            'spec': {
              'valueNames': {
                'email': 'EEEEmail',
                'text': 'Texxxt',
                'call': 'Ccccall',
                'push': 'PuuuusH',
                'webhook': 'WebHooookkeee',
              },
              'values': [
                'email',
                'text',
                'call',
                'push',
                'webhook',
              ],
            },
          },
        },
      },
      'bitcoinNode': {
        'name': 'Bitcoin Node Settings',
        'type': 'union',
        'uniqueBy': null,
        'description': 'The node settings',
        'default': 'internal',
        'changeWarning': 'Careful changing this',
        'tag': {
            'id': 'type',
            'name': 'Type',
            'variantNames': {
              'internal': 'Internal',
              'external': 'External',
            },
        },
        'variants': {
          'internal': {
            'lan-address': {
              'name': 'LAN Address',
              'type': 'pointer',
              'subtype': 'app',
              'target': 'lan-address',
              'app-id': 'bitcoind',
              'description': 'the lan address',
            },
          },
          'external': {
            'public-domain': {
              'name': 'Public Domain',
              'type': 'string',
              'description': 'the public address of the node',
              'nullable': false,
              'default': 'bitcoinnode.com',
              'pattern': '.*',
              'patternDescription': 'anything',
              'masked': false,
              'copyable': true,
            },
          },
        },
      },
      'port': {
        'name': 'Port',
        'type': 'number',
        'integral': true,
        'description': 'the default port for your Bitcoin node. default: 8333, testnet: 18333, regtest: 18444',
        'nullable': false,
        'default': 8333,
        'range': '[0, 9999]',
      },
      'favoriteSlogan': {
        'name': 'Favorite Slogan',
        'type': 'string',
        'description': 'You most favorite slogan in the whole world, used for paying you.',
        'nullable': true,
        'masked': true,
        'copyable': true,
      },
      'rpcallowip': {
        'name': 'RPC Allowed IPs',
        'type': 'list',
        'subtype': 'string',
        'description': 'external ip addresses that are authorized to access your Bitcoin node',
        'changeWarning': 'Any IP you allow here will have RPC access to your Bitcoin node.',
        'range': '[1,10]',
        'default': [
          '192.168.1.1',
        ],
        'spec': {
          'pattern': '((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|((^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]).){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]).){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$)|(^[a-z2-7]{16}\\.onion$)|(^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$))',
          'patternDescription': 'must be a valid ipv4, ipv6, or domain name',
        },
      },
      'rpcauth': {
        'name': 'RPC Auth',
        'type': 'list',
        'subtype': 'string',
        'description': 'api keys that are authorized to access your Bitcoin node.',
        'range': '[0,*)',
        'default': [],
        'spec': { },
      },
    },
    // actual config
    config: {
      // testnet: undefined,
      // objectList: undefined,
      // unionList: undefined,
      // randomEnum: 'option1',
      // favoriteNumber: 8,
      // secondaryNumbers: undefined,
      // rpcsettings: {
      //   laws: null,
      //   rpcpass: null,
      //   rpcuser: '123',
      //   rulemakers: [],
      // },
      // advanced: {
      //   notifications: ['call'],
      // },
      // bitcoinNode: undefined,
      // port: 5959,
      // maxconnections: null,
      // rpcallowip: undefined,
      // rpcauth: ['matt: 8273gr8qwoidm1uid91jeh8y23gdio1kskmwejkdnm'],
    },
  }

  export const mockCupsDependentConfig = {
    randomEnum: 'option1',
    testnet: false,
    favoriteNumber: 8,
    secondaryNumbers: [13, 58, 20],
    objectList: [],
    unionList: [],
    rpcsettings: {
      laws: null,
      rpcpass: null,
      rpcuser: '123',
      rulemakers: [],
    },
    advanced: {
      notifications: [],
    },
    bitcoinNode: { type: 'internal' },
    port: 5959,
    maxconnections: null,
    rpcallowip: [],
    rpcauth: ['matt: 8273gr8qwoidm1uid91jeh8y23gdio1kskmwejkdnm'],
  }
}
