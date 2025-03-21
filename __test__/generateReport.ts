import fs from 'node:fs';
import path from 'node:path';

type ParsedResult = {
  contract: {
    name: string;
    write: {
      [method: string]: {
        effects: string[];
        permissions: string[];
        validations: string[];
        events: string[];
      };
    };
    read: {
      [method: string]: {
        returns: string[];
      };
    };
  };
};

function parseTestReport(input: any[]): ParsedResult[] {
  const output: ParsedResult[] = [];

  const contractMap: Record<
    string,
    {
      write: Record<string, { effects: string[]; permissions: string[]; validations: string[]; events: string[] }>;
      read: Record<string, { returns: string[] }>;
    }
  > = {};

  input.forEach((_row) => {
    const isReadSuite = _row.name.endsWith('read.spec.ts');
    const isWriteSuite = _row.name.endsWith('write.spec.ts');

    _row.assertionResults.forEach((item: any) => {
      const [contractName, methodName, category] = item.ancestorTitles;
      const description = item.title;

      if (!contractMap[contractName]) {
        contractMap[contractName] = {
          write: {},
          read: {}
        };
      }

      if (isWriteSuite) {
        if (!contractMap[contractName].write[methodName]) {
          contractMap[contractName].write[methodName] = {
            effects: [],
            permissions: [],
            validations: [],
            events: []
          };
        }

        if (category in contractMap[contractName].write[methodName]) {
          contractMap[contractName].write[methodName][
            category as keyof (typeof contractMap)['contractName']['write']['methodName']
          ].push(description);
        }
      }

      if (isReadSuite) {
        if (!contractMap[contractName].read[methodName]) {
          contractMap[contractName].read[methodName] = {
            returns: []
          };
        }

        if (category === 'returns') {
          contractMap[contractName].read[methodName].returns.push(description);
        }
      }
    });
  });

  for (const [contractName, methods] of Object.entries(contractMap)) {
    output.push({
      contract: {
        name: contractName,
        write: methods.write,
        read: methods.read
      }
    });
  }

  const trackedSuites = [
    'ScoutProtocolNFTProxy',
    'ScoutProtocolNFTImplementation',
    'ScoutTokenERC20Proxy',
    'ScoutTokenERC20Implementation',
    'ProtocolEASResolver',
    'ScoutProtocolProxy',
    'ScoutProtocolImplementation',
    'LockupWeeklyStreamCreator',
    // Utilities
    'MemoryUtils',
    'ProtocolAccessControl'
  ];
  return output
    .filter((item) => trackedSuites.includes(item.contract.name))
    .sort((a, b) => a.contract.name.localeCompare(b.contract.name));
}

export function convertReportToMarkdown(report: ParsedResult[]): string {
  let markdown = `# Test Report\n\n`;

  report.forEach(({ contract }) => {
    markdown += `## Contract: ${contract.name}\n\n`;

    if (Object.keys(contract.write).length > 0) {
      markdown += `### Write Methods\n\n`;

      Object.entries(contract.write).forEach(([method, details]) => {
        markdown += `#### ${method}\n\n`;

        if (details.effects.length > 0) {
          markdown += `- **Effects**:\n`;
          details.effects.forEach((effect) => {
            markdown += `  - ${effect}\n`;
          });
        }

        if (details.permissions.length > 0) {
          markdown += `- **Permissions**:\n`;
          details.permissions.forEach((permission) => {
            markdown += `  - ${permission}\n`;
          });
        }

        if (details.validations.length > 0) {
          markdown += `- **Validations**:\n`;
          details.validations.forEach((validation) => {
            markdown += `  - ${validation}\n`;
          });
        }

        if (details.events.length > 0) {
          markdown += `- **Events**:\n`;
          details.events.forEach((event) => {
            markdown += `  - ${event}\n`;
          });
        }

        markdown += `\n`;
      });
    }

    if (Object.keys(contract.read).length > 0) {
      markdown += `### Read Methods\n\n`;

      Object.entries(contract.read).forEach(([method, details]) => {
        markdown += `#### ${method}\n\n`;

        if (details.returns.length > 0) {
          markdown += `- **Returns**:\n`;
          details.returns.forEach((returnValue) => {
            markdown += `  - ${returnValue}\n`;
          });
        }

        markdown += `\n`;
      });
    }
  });

  return markdown;
}

export function loadAndGenerateTestReport() {
  const input = fs.readFileSync(path.resolve('report.json'), 'utf8');
  const parsedOutput = parseTestReport(JSON.parse(input).testResults);

  const asMarkdown = convertReportToMarkdown(parsedOutput);

  fs.writeFileSync(path.resolve('test-report.md'), asMarkdown);

  return parsedOutput;
}
