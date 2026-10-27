import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import FieldInfoTooltip from './FieldInfoTooltip.jsx';

describe('FieldInfoTooltip', () => {
  it('provides unique tooltip IDs for multiple instances', async () => {
    const user = userEvent.setup();
    render(
      <>
        <FieldInfoTooltip title="First" text="First details" />
        <FieldInfoTooltip title="Second" text="Second details" />
      </>
    );

    const firstButton = screen.getByRole('button', { name: 'First information' });
    const secondButton = screen.getByRole('button', { name: 'Second information' });

    await user.tab();
    expect(firstButton).toHaveFocus();
    const firstTooltipId = screen.getByRole('tooltip').id;
    expect(firstButton).toHaveAttribute('aria-describedby', firstTooltipId);

    await user.tab();
    expect(secondButton).toHaveFocus();
    const secondTooltipId = screen.getByRole('tooltip').id;
    expect(secondTooltipId).not.toBe(firstTooltipId);
    expect(secondButton).toHaveAttribute('aria-describedby', secondTooltipId);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<FieldInfoTooltip title="Details" text="More information" />);

    const button = screen.getByRole('button', { name: 'Details information' });
    await user.click(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});
