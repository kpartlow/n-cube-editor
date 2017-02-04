import ncube.grv.exp.NCubeGroovyExpression

class Hello extends NCubeGroovyExpression
{
    def run()
    {
        println Constants.WELCOME_MESSAGE
        println 'changed both main class and constants'
    }
}