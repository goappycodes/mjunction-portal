-- =====================================================================
-- Call duration capture, alongside recording_url.
--
-- Exotel's StatusCallback carries `Duration`/`DialCallDuration` in the same
-- request that supplies `RecordingUrl`, but nothing persisted it: the mock
-- provider path already writes voc_recordings.duration_seconds
-- (src/lib/domain/call-flow.ts), while the real-Exotel path
-- (mjunction-ivr-engine status-callback -> attachCallRecording) parsed the
-- value and then discarded it, so every real call showed 0s in the VOC/
-- Reports UI. Stored on call_attempts (next to recording_url/
-- provider_call_ref) rather than only on voc_recordings, so it survives for
-- calls that never get sealed as a VOC too.
-- =====================================================================

alter table call_attempts add column if not exists duration_seconds integer;

notify pgrst, 'reload schema';
