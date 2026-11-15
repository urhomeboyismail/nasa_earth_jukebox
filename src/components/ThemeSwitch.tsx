import { useTheme } from '../hooks/useTheme'
import { Button } from './Button'
import { Icon } from './Icon'
import { useAnnounce } from './useAnnounce'

/**
 * The Night/Day switch (UI01). One toggle named "Day theme": pressed means Day is on, not pressed means Night. The name does
 * not change, so a screen reader says "Day theme, pressed" or "not pressed". The change is announced.
 */
export function ThemeSwitch() {
  const [theme, setTheme] = useTheme()
  const announce = useAnnounce()
  const day = theme === 'day'
  return (
    <Button
      className="ui-theme-switch"
      pressed={day}
      onClick={() => {
        setTheme(day ? 'night' : 'day')
        announce(day ? 'Night theme' : 'Day theme')
      }}
    >
      {/* On a phone the header shows the sun alone (src/App.css); the name is still "Day theme". */}
      <Icon name="sun" size={24} className="ui-theme-switch__icon" />
      <span className="ui-theme-switch__label">Day theme</span>
    </Button>
  )
}
