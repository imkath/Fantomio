import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Logo } from '../logo'

describe('Logo', () => {
  it('shows the ghost and the lowercase wordmark', () => {
    const { container } = render(<Logo linkToHome={false} />)
    expect(screen.getByText('ghostswap')).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('links home with an accessible name by default', () => {
    render(<Logo />)
    const link = screen.getByRole('link', { name: /ghostswap/i })
    expect(link).toHaveAttribute('href', '/')
  })

  it('renders without a link when linkToHome is false', () => {
    render(<Logo linkToHome={false} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('scales the wordmark with the size prop', () => {
    const { rerender } = render(<Logo size="sm" linkToHome={false} />)
    expect(screen.getByText('ghostswap')).toHaveClass('text-base')

    rerender(<Logo size="md" linkToHome={false} />)
    expect(screen.getByText('ghostswap')).toHaveClass('text-[22px]')

    rerender(<Logo size="lg" linkToHome={false} />)
    expect(screen.getByText('ghostswap')).toHaveClass('text-3xl')
  })

  it('uses the display face for the wordmark', () => {
    render(<Logo linkToHome={false} />)
    expect(screen.getByText('ghostswap')).toHaveClass('font-display')
  })
})
