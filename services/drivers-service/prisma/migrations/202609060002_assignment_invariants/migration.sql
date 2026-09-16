-- Fail safely on inconsistent historical data; never delete assignments to satisfy an index.
CREATE UNIQUE INDEX "one_active_assignment_per_order"
ON "driver_assignments" ("orderId") WHERE status IN ('OFFERED', 'ACCEPTED');
CREATE UNIQUE INDEX "one_active_assignment_per_driver"
ON "driver_assignments" ("driverId") WHERE status IN ('OFFERED', 'ACCEPTED');
CREATE UNIQUE INDEX "one_active_call_per_order"
ON "call_sessions" ("orderId") WHERE status IN ('RINGING', 'ACTIVE');
