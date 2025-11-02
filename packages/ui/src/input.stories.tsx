import type { Meta, StoryObj } from '@storybook/react';

import { Input } from './input.js';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  args: {
    placeholder: 'Enter text…',
  },
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};
export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
