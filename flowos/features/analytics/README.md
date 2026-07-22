# Analytics feature boundary

This folder is intentionally a feature boundary, not a place for shared FlowOS code.
The future analytics capability is designed to be detachable into its own service while
the current product consumes it through stable contracts only.

The design, data contracts, domain model, delivery stages, and proposed future folder
layout are documented in:

`Planning and setup/Analytics Feature/analytics-feature-plan.md`

Do not place analytics execution logic in the generic flow executor. The future
implementation belongs in `apps/analytics-worker` and `packages/analytics-*`, with a
small adapter at the FlowOS API boundary.
