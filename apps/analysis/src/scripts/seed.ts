import 'dotenv/config';
import { medplumEnabled, createTransactionBundle } from '../medplumClient.js';
import { demoIds } from '../data.js';

function makePatient(id = demoIds.patient) {
  return {
    resourceType: 'Patient',
    id,
    name: [{ use: 'official', family: 'Ramirez', given: ['Maya'] }],
    gender: 'female',
    birthDate: '1990-05-12',
  } as const;
}

function makePractitioner(id = demoIds.practitioner) {
  return {
    resourceType: 'Practitioner',
    id,
    name: [{ family: 'Doe', given: ['Alex'] }],
  } as const;
}

function makeSchedule(id = demoIds.schedule, practitionerRef = `Practitioner/${demoIds.practitioner}`) {
  return {
    resourceType: 'Schedule',
    id,
    actor: [{ reference: practitionerRef }],
  } as const;
}

function makeSlot(slotId: string = demoIds.rheumatologySlotOne, scheduleRef: string = `Schedule/${demoIds.schedule}`, start?: string, end?: string) {
  const now = new Date();
  const startTime = start ?? new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const endTime = end ?? new Date(now.getTime() + 48 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();

  return {
    resourceType: 'Slot',
    id: slotId,
    schedule: { reference: scheduleRef },
    start: startTime,
    end: endTime,
    status: 'free',
  } as const;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-n');

  const resources = [
    makePatient(),
    makePractitioner(),
    makeSchedule(),
    makeSlot(demoIds.rheumatologySlotOne),
    makeSlot(demoIds.rheumatologySlotTwo),
  ];

  if (dryRun) {
    // Print resources and exit
    // eslint-disable-next-line no-console
    console.log('Dry run: the following resources would be created:');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(resources, null, 2));
    return;
  }

  if (!medplumEnabled()) {
    // eslint-disable-next-line no-console
    console.log('MEDPLUM_ENABLED is not set. Run with MEDPLUM_ENABLED=true and provide MEDPLUM_TOKEN to actually create resources.');
    // eslint-disable-next-line no-console
    console.log('Use --dry-run to avoid attempting network writes.');
    return;
  }

  // Seed related resources as one transaction so their fixed demo references
  // resolve together in Medplum.
  // eslint-disable-next-line no-console
  console.log('Creating resources in Medplum...');
  const result = await createTransactionBundle({
    resourceType: 'Bundle',
    id: '8651a6be-9cc6-43eb-9d81-b9a5223b704d',
    type: 'collection',
    entry: resources.map((resource) => ({ resource })),
  });
  if (!result) {
    throw new Error('Medplum rejected the synthetic seed transaction');
  }
  // eslint-disable-next-line no-console
  console.log('Seed transaction completed.');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ resourceCount: resources.length }, null, 2));
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed script failed:', (err as Error).message ?? err);
  process.exit(1);
});
