/**
 * /login and /signup. Both routes render this page with a different `mode`, so
 * React keeps the same AuthForm instance and the switch animates in place.
 * On desktop an intro column sits beside the card; phones and tablets get the card only.
 */
import logoMark from '../../../docs/assets/svg/logo-mark.svg'
import { AuthForm, type AuthMode } from './AuthForm'
import './auth.css'

export function AuthPage({ mode }: { mode: AuthMode }) {
  return (
    <div className="auth">
      <div className="auth__intro">
        <p className="brand">
          <img className="brand__mark" src={logoMark} alt="" aria-hidden="true" />
          breadcrumb
        </p>
        <p className="page-title">You’ve lived here.</p>
        <p className="page-sub">Have you explored it?</p>
        <ol className="stops">
          <li className="stop">
            <span className="num-ring">1</span>
            <div>
              <p className="stop__name">Pick a trail</p>
              <p className="stop__place">Short outings around Boston, made by students.</p>
            </div>
          </li>
          <li className="stop">
            <span className="num-ring">2</span>
            <div>
              <p className="stop__name">Get there</p>
              <p className="stop__place">By T, bus, bike, or on foot.</p>
            </div>
          </li>
          <li className="stop">
            <span className="num-ring">3</span>
            <div>
              <p className="stop__name">Check off crumbs</p>
              <p className="stop__place">Then rate it for the next person.</p>
            </div>
          </li>
        </ol>
      </div>

      <AuthForm mode={mode} />
    </div>
  )
}
