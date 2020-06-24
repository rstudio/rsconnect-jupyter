describe('Add server', () => {
  it('Visits the front page', () => {
    cy.visit('http://jupyter:9483')
  })

  it('Creates a new notebook', () => {
    cy.contains('New').click()
    cy.contains('Python 3').click()
  })
})
