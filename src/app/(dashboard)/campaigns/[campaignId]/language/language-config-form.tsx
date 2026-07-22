'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateLanguageConfig } from '@/app/actions/campaigns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from '@/components/ui/primitives';
import type { Campaign, Language, LanguageConfigEntry } from '@/lib/database.types';
import { Trash2, Plus } from 'lucide-react';

export function LanguageConfigForm({
  campaign,
  languages,
}: {
  campaign: Campaign;
  languages: Language[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [entries, setEntries] = useState<LanguageConfigEntry[]>(
    campaign.language_config.length
      ? campaign.language_config
      : [{ dtmf: '1', lang: 'hi' }],
  );
  const [defaultLang, setDefaultLang] = useState(campaign.default_language);
  const [retryLimit, setRetryLimit] = useState(campaign.retry_limit);
  const [skipMenu, setSkipMenu] = useState(campaign.skip_menu_if_known);
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);

  function update(i: number, patch: Partial<LanguageConfigEntry>) {
    setEntries((e) => e.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function addRow() {
    const nextDtmf = String(entries.length + 1);
    const unused = languages.find((l) => !entries.some((e) => e.lang === l.code));
    setEntries((e) => [...e, { dtmf: nextDtmf, lang: unused?.code ?? 'hi' }]);
  }
  function removeRow(i: number) {
    setEntries((e) => e.filter((_, idx) => idx !== i));
  }

  function save() {
    setMsg(null);
    start(async () => {
      const res = await updateLanguageConfig({
        campaignId: campaign.id,
        default_language: defaultLang,
        retry_limit: retryLimit,
        skip_menu_if_known: skipMenu,
        language_config: entries,
      });
      setMsg(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>IVR language menu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>DTMF → language map</Label>
          <p className="text-xs text-[var(--muted)]">
            The key the recipient presses to select a language. Default map is 1=Hindi, 2=English.
            Add rows to enable regional languages per order — no redesign needed.
          </p>
          <div className="space-y-2">
            {entries.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={row.dtmf}
                  onChange={(e) => update(i, { dtmf: e.target.value })}
                  className="w-16 text-center"
                  aria-label="DTMF key"
                />
                <span className="text-[var(--muted)]">→</span>
                <Select
                  value={row.lang}
                  onChange={(e) => update(i, { lang: e.target.value })}
                  className="w-48"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.display_name}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(i)}
                  disabled={entries.length <= 1}
                >
                  <Trash2 className="h-4 w-4 text-[var(--danger)]" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4" /> Add language
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="default_lang">Default (fallback) language</Label>
            <Select
              id="default_lang"
              value={defaultLang}
              onChange={(e) => setDefaultLang(e.target.value)}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.display_name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-[var(--muted)]">Used after N no-input retries.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="retry">Retry limit</Label>
            <Input
              id="retry"
              type="number"
              min={0}
              max={10}
              value={retryLimit}
              onChange={(e) => setRetryLimit(parseInt(e.target.value || '0', 10))}
            />
            <p className="text-xs text-[var(--muted)]">No-input/invalid attempts before fallback.</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={skipMenu}
            onChange={(e) => setSkipMenu(e.target.checked)}
            className="h-4 w-4"
          />
          Skip the menu on repeat calls when a language is already known (press 9 to change)
        </label>

        {msg?.error && <p className="text-sm text-[var(--danger)]">{msg.error}</p>}
        {msg?.ok && <p className="text-sm text-[var(--success)]">Saved.</p>}

        <div className="flex justify-end">
          <Button onClick={save} loading={pending}>
            {pending ? 'Saving…' : 'Save configuration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
