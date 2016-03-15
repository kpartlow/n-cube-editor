describe('base test', function() {

    beforeEach(function() {
        //browser.ignoreSynchronization=true;
    });

    it('should have title', function () {
        browser.get('index.html');
        var titleTag = element.all(by.id('appTitle'));
        expect(titleTag.count()).toBe(1);
    });
});