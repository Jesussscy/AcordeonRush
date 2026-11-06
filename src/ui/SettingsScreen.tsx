import { useEffect, useState } from 'react';
import { defaultSettings, type Settings } from '../core/settings';
import { defaultBindings, detectKeyboardLayout, keyLabel, type GameAction } from '../input/bindings';
import { melodyButtons } from '../instrument/accordion-catalog';
import { midiInputSupported } from '../input/midi-input';

type Props = { settings: Settings; onChange(next: Settings): void; onBack(): void };

const ROW_NAMES = ['Hilera de afuera', 'Hilera del medio', 'Hilera de adentro'];
const ACTION_NAMES: Record<GameAction, string> = {
  bellows: 'Fuelle (mantener = cerrar)',
  parranda: 'Modo Parranda',
  pause: 'Pausa',
};

/** Settings: bellows assist, sound, graphics and remappable controls. */
export default function SettingsScreen({ settings, onChange, onBack }: Props) {
  const [listening, setListening] = useState<{ kind: 'button' | 'action'; id: string } | null>(null);
  const [, setLayoutReady] = useState(0);
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const label = (code: string) => keyLabel(code, settings.keyboardLayout);

  useEffect(() => {
    void detectKeyboardLayout().then(() => setLayoutReady((n) => n + 1));
  }, []);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape' && listening.kind === 'button') return setListening(null);
      const bindings = structuredClone(settings.bindings);
      // A key can only do one thing: free it from any other binding first.
      for (const [id, code] of Object.entries(bindings.buttons)) if (code === e.code) bindings.buttons[id] = '';
      for (const [id, code] of Object.entries(bindings.actions))
        if (code === e.code) bindings.actions[id as GameAction] = '';
      if (listening.kind === 'button') bindings.buttons[listening.id] = e.code;
      else bindings.actions[listening.id as GameAction] = e.code;
      onChange({ ...settings, bindings });
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, settings, onChange]);

  return (
    <main className="vh-screen">
      <button className="vh-back" onClick={onBack}>
        ← Menú
      </button>
      <h1 className="vh-logo" style={{ fontSize: 'clamp(44px, 7vw, 76px)' }}>
        Ajustes
      </h1>

      <h2 className="vh-section-title">Juego</h2>
      <label className="vh-check">
        <input
          type="checkbox"
          checked={settings.assistedBellows}
          onChange={(e) => set({ assistedBellows: e.target.checked })}
        />
        Fuelle asistido (el juego mueve el fuelle por ti; solo para aprender)
      </label>
      <label className="vh-check">
        <input
          type="checkbox"
          checked={settings.showKeyHints}
          onChange={(e) => set({ showKeyHints: e.target.checked })}
        />
        Mostrar la tecla en cada gema
      </label>

      <h2 className="vh-section-title">Sonido y gráficos</h2>
      <label className="vh-field">
        Volumen: {Math.round(settings.volume * 100)}%
        <input
          type="range"
          min={0}
          max={100}
          value={settings.volume * 100}
          onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
        />
      </label>
      <label className="vh-field">
        Calidad gráfica
        <select value={settings.quality} onChange={(e) => set({ quality: e.target.value as Settings['quality'] })}>
          <option value="high">Alta (brillos, público y reflectores)</option>
          <option value="low">Baja (para portátiles sin tarjeta gráfica)</option>
        </select>
      </label>
      <label className="vh-field">
        Etiquetas del teclado
        <select
          value={settings.keyboardLayout}
          onChange={(e) => set({ keyboardLayout: e.target.value as Settings['keyboardLayout'] })}
        >
          <option value="auto">Automático (según tu teclado)</option>
          <option value="es">Español</option>
          <option value="en">Inglés (US)</option>
        </select>
      </label>

      <h2 className="vh-section-title">Controles</h2>
      <p style={{ color: 'var(--vh-dim)' }}>
        Haz clic en una tecla y luego presiona la nueva. {listening ? 'Esperando tecla… (Esc cancela)' : ''}
      </p>
      <div className="vh-row">
        {(Object.keys(ACTION_NAMES) as GameAction[]).map((action) => (
          <button
            key={action}
            className="vh-btn"
            aria-pressed={listening?.id === action}
            onClick={() => setListening({ kind: 'action', id: action })}
          >
            {ACTION_NAMES[action]}:{' '}
            <span className="vh-kbd">
              {settings.bindings.actions[action] ? label(settings.bindings.actions[action]) : '—'}
            </span>
          </button>
        ))}
      </div>
      {ROW_NAMES.map((name, row) => (
        <div key={name}>
          <h3 style={{ margin: '16px 0 8px' }}>{name}</h3>
          <div className="vh-row" style={{ gap: 6 }}>
            {melodyButtons
              .filter((b) => b.row === row)
              .map((b) => (
                <button
                  key={b.id}
                  className="vh-btn"
                  style={{ padding: '8px 10px', display: 'grid', gap: 2, textAlign: 'center' }}
                  aria-pressed={listening?.id === b.id}
                  onClick={() => setListening({ kind: 'button', id: b.id })}
                  title={`Botón ${b.code}`}
                >
                  <small>{b.code}</small>
                  <span className="vh-kbd">
                    {settings.bindings.buttons[b.id] ? label(settings.bindings.buttons[b.id]) : '—'}
                  </span>
                </button>
              ))}
          </div>
        </div>
      ))}
      <p style={{ color: 'var(--vh-dim)', marginTop: 16 }}>
        Controlador MIDI:{' '}
        {midiInputSupported()
          ? 'compatible. Conéctalo y cada nota MIDI tocará el botón que da esa nota.'
          : 'este navegador no soporta Web MIDI.'}
      </p>
      <div className="vh-row" style={{ marginTop: 16 }}>
        <button className="vh-btn" onClick={() => set({ bindings: defaultBindings() })}>
          Restaurar controles
        </button>
        <button className="vh-btn" onClick={() => onChange({ ...defaultSettings(), design: settings.design })}>
          Restaurar todo
        </button>
      </div>
    </main>
  );
}
