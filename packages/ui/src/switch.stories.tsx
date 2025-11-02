import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Switch } from './switch.js';

const meta: Meta<typeof Switch> = {
  title: 'Components/Switch',
  component: Switch,
  args: {
    label: 'Toggle option',
    defaultChecked: true,
  },
};

export default meta;

type Story = StoryObj<typeof Switch>;

export const Default: Story = {};
export const Unchecked: Story = {
  args: {
    defaultChecked: false,
  },
};
