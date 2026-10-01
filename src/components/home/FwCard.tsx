import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { FwFigure, type FwFigureProps } from './FwFigure';
import { soundFx } from '../../lib/soundFx';

export interface FwCardProps {
  figure: FwFigureProps;
  kicker: string;
  title: string;
  description: string;
  href?: string;
  className?: string;
  cursorLabel?: string;
  onClick?: () => void;
}

/**
 * FwCard - Junca Studio Showcase Card with:
 * - FwFigure image container with internal parallax, tags, and WebGL morph tile
 * - Interactive metadata footer (.fw__art) with dot disappearance (.fw__dot)
 * - Kinetic text displacement (.fw__txt)
 * - Expanding circular arrow action pill (.fw__ic)
 */
export const FwCard: React.FC<FwCardProps> = ({
  figure,
  kicker,
  title,
  description,
  href = '#active-cohorts',
  className = '',
  cursorLabel = 'VIEW PROJECT',
  onClick,
}) => {
  return (
    <li className={`fw__card ${className}`}>
      <a
        href={href}
        data-cursor={cursorLabel}
        onClick={(e) => {
          soundFx.playSweep(280, 640, 0.1, 0.04);
          if (onClick) {
            e.preventDefault();
            onClick();
          }
        }}
        onMouseEnter={() => soundFx.playBlip(540, 0.025, 'sine', 0.02)}
        className="fw__link group"
        aria-label={`${title} - ${kicker}`}
      >
        <FwFigure {...figure} />

        <div className="fw__art">
          <span className="fw__dot" aria-hidden="true" />
          <div className="fw__txt">
            <span className="fw__kicker">{kicker}</span>
            <h3 className="fw__title">{title}</h3>
            <p className="fw__text">{description}</p>
          </div>
          <div className="fw__ic" aria-hidden="true">
            <ArrowUpRight size={18} />
          </div>
        </div>
      </a>
    </li>
  );
};
