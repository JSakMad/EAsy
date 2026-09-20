import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SchoolSwitcher } from '../components/school-switcher';
import { LsuExperience } from '../components/lsu-experience';

vi.mock('../components/account-nav', () => ({ AccountNav: () => <span>Account</span> }));
afterEach(cleanup);

describe('separate school experiences', () => {
  it('searches schools and links to separate routes', () => {
    render(<SchoolSwitcher />);
    fireEvent.click(screen.getByText('Pitt'));
    const search = screen.getByLabelText('Find your school');
    fireEvent.change(search, { target: { value: 'LSU' } });
    expect(screen.getByRole('link', { name: /Louisiana State/ }).getAttribute('href')).toBe('/schools/lsu');
    expect(screen.queryByRole('link', { name: /University of Pittsburgh/ })).toBeNull();
    fireEvent.change(search, { target: { value: 'unknown school' } });
    expect(screen.getByRole('status').textContent).toContain('not available');
  });
  it('finds the fictional course by code, title, and professor without Pitt links', () => {
    render(<LsuExperience />);
    expect(screen.getByRole('region', { name: 'Course notebook' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next notebook page' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Previous notebook page' })).toHaveProperty('disabled', true);
    const search = screen.getByRole('textbox', { name: 'Search LSU courses or professors' });
    for (const value of ['demo101', 'Creative Problem', 'Avery Rowan']) {
      fireEvent.change(search, { target: { value } });
      expect(screen.getByRole('link', { name: /DEMO 101/ }).getAttribute('href')).toBe('/schools/lsu/courses/demo-101');
    }
    fireEvent.change(search, { target: { value: 'CS0447' } });
    expect(screen.getByText('This course does not exist in the LSU demo')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Leave.*review/ })).toBeNull();
  });
});
