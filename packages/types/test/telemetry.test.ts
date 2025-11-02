import { describe, it, expectTypeOf } from 'vitest';

import { type TelemetryEventName, type TelemetryEventPayload } from '../src/telemetry.js';

describe('telemetry events', () => {
  it('exposes known event names', () => {
    type Name = TelemetryEventName;
    expectTypeOf<'command_palette_button'>().toMatchTypeOf<Name>();
    expectTypeOf<'run_submitted'>().toMatchTypeOf<Name>();
  });

  it('maps payload types', () => {
    expectTypeOf<TelemetryEventPayload<'command_palette_button'>>().toEqualTypeOf<undefined>();
    expectTypeOf<TelemetryEventPayload<'pwa_install_attempt'>>().toMatchTypeOf<{ pendingOutbox: number }>();
  });
});
