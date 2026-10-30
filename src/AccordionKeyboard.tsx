import { Wind } from 'lucide-react';
import { bassKeys, melodyKeys, tuningOffsets, type BellowsDirection } from './instrument';

type Props = {
  tuning: string;
  onTuningChange: (value: string) => void;
  direction: BellowsDirection;
  bellows: boolean;
  activeKeys: Set<string>;
  audioReady: boolean;
  onPlay: (id: string, frequency: number, kind?: 'melody' | 'bass', direction?: BellowsDirection) => void;
  onStop: (id: string) => void;
  onBellows: (held: boolean, direction?: BellowsDirection) => void;
};

export function AccordionKeyboard(props: Props) {
  return <section className="virtual-accordion" aria-label="Acordeón vallenato virtual">
    <div className="virtual-instrument-head"><div><span className="instrument-maker">GCF · SISTEMA DIATÓNICO</span><strong>Tu acordeón vallenato</strong></div><label className="tuning-picker">TONALIDAD<select aria-label="Tonalidad" value={props.tuning} onChange={event => props.onTuningChange(event.target.value)}>{Object.keys(tuningOffsets).map(value => <option key={value}>{value}</option>)}</select></label></div>
    <div className={`virtual-accordion-body ${props.bellows ? `playing-bellows ${props.direction}` : ''}`}>
      <div className="virtual-bass-box"><span className="box-label">BAJOS · ACORDES</span><div className="virtual-bass-grid">{bassKeys.map(key => <button key={key.id} className={`virtual-bass ${key.row} ${props.activeKeys.has(key.id) ? 'pressed' : ''}`} onPointerDown={event => { event.preventDefault(); props.onPlay(key.id, key.push, 'bass', 'push'); }} onPointerUp={() => props.onStop(key.id)} onPointerLeave={() => props.onStop(key.id)} aria-label={`Bajo ${key.note}, tecla ${key.label}`}><span>{key.label}</span></button>)}</div></div>
      <div className={`virtual-bellows ${props.bellows ? 'expanded' : ''}`}><span>FUELLE</span>{Array.from({length:12},(_,index)=><i key={index} />)}</div>
      <div className="virtual-melody-box"><div className="box-badge"><span>31 TECLAS · PUSH / PULL</span><strong>ACORDEÓN DIATÓNICO</strong></div><div className="virtual-melody-grid">{melodyKeys.map(key => <button key={key.id} style={{ '--button-position':key.rowIndex, '--row-position':key.row === 'outer' ? 0 : key.row === 'middle' ? 1 : 2, '--row-count':key.row === 'outer' ? 11 : 10 } as React.CSSProperties} className={`virtual-melody ${key.row} ${props.activeKeys.has(key.id) ? 'pressed' : ''}`} onPointerDown={event => { event.preventDefault(); props.onPlay(key.id, props.direction === 'push' ? key.push : key.pull, 'melody', props.direction); }} onPointerUp={() => props.onStop(key.id)} onPointerLeave={() => props.onStop(key.id)} aria-label={`Tocar ${key.note}, tecla ${key.label}`}><strong>{key.label}</strong><small>{(props.direction === 'push' ? key.note.split(' / ')[0] : key.note.split(' / ')[1])}</small></button>)}</div></div>
    </div>
    <div className="bellows-controls"><span><Wind size={13} /> {props.bellows ? props.direction === 'pull' ? 'HALANDO · SUENA' : 'EMPUJANDO · SUENA' : 'MANTÉN PARA MOVER EL FUELLE'}</span><button className={props.bellows && props.direction === 'pull' ? 'active' : ''} onPointerDown={event => { event.preventDefault(); props.onBellows(true,'pull'); }} onPointerUp={() => props.onBellows(false)} onPointerLeave={() => props.onBellows(false)}>ESPACIO · HALAR</button><button className={props.bellows && props.direction === 'push' ? 'active' : ''} onPointerDown={event => { event.preventDefault(); props.onBellows(true,'push'); }} onPointerUp={() => props.onBellows(false)} onPointerLeave={() => props.onBellows(false)}>SHIFT + ESPACIO · EMPUJAR</button>{!props.audioReady && <span className="audio-hint">EL SONIDO SE ACTIVA AL TOCAR UNA TECLA</span>}</div>
  </section>;
}
