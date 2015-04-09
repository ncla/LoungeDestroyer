var expect = chai.expect;

var itemHtml = '<div class="oitm"> <div class="name"> <b>AWP | Lightning Strike (Factory New)</b><br> <i> Covert</i><br><a onclick="previewItem($(this))">Preview</a> | <a href="http://steamcommunity.com/market/listings/730/AWP | Lightning Strike (Factory New)" target="_blank">Market</a> | <a href="/result?&rdef_index[]=33&rquality[]=0">Search</a> </div> <div class="item"> <img class="smallimg" src="https://steamcommunity-a.akamaihd.net/economy/image/pMf_VkmOZmA-BExzZnSugxyLNecN_mgg6sqfaYKS5iRtzMitEJIgcp7dUI1AFPINBIxuoAThaCTswZh7g4TxLmKO3KcBlid7jqxUh0Ne4RwAmiW4QLQmPeDAqWnbkc0gYf7UqwCfJnmTnVS9TEzjIhiWJv9D_yUou5zGOZyF9nY5wIqjBZVkcsrEUdIcX_ZKTMckp1K0cC--y8RqldS8MWLG/99fx66f" alt="AWP | Lightning Strike (Factory New)" /> <div class="rarity Covert">Factory New                    </div> </div></div>';

describe('Items', function() {

    beforeEach(function() {
        window.LoungeUser = new User();
        LoungeUser.userSettings = LoungeUser.defaultSettings;
        window.blacklistedItemList = {};
        window.currencies = {"USDAUD":1.2951,"USDBRL":3.1271,"USDCAD":1.2415,"USDEUR":0.9201,"USDGBP":0.6693,"USDIDR":12958,"USDJPY":119.734,"USDKRW":1089.995,"USDMXN":14.8588,"USDMYR":3.6223,"USDNOK":7.9882,"USDNZD":1.3173,"USDPHP":44.4895,"USDRUB":53.6185,"USDSGD":1.3542,"USDTHB":32.5365,"USDTRY":2.5879,"USDUAH":23.525,"USDUSD":1,"USDVND":21605};
        window.appID = '730';
        window.marketedItems = {};
    });

    describe('constructor', function() {

        it('should set Items.item, Items.itemName, Items.weaponQuality and Items.weaponQualityAbbrevation', function() {
            var item = new Item($(itemHtml));
            expect(item).to.have.keys(['item', 'itemName', 'weaponQuality', 'weaponQualityAbbrevation']);
        });
    });

    describe('getMarketPrice', function() {
        it('should not get market price because it is black-listed', function() {
            var item = new Item($(itemHtml));

            blacklistedItemList = {'AWP | Lightning Strike (Factory New)': true};

            LoungeUser.userSettings.useCachedPriceList = '0';

            item.getMarketPrice();
            expect(item).to.not.have.property('marketValue');
            expect(item).to.not.have.property('marketPriced');
        });

        it('should get market price from cached price list and set item.marketPriced and item.marketValue properties', function() {
            window.storageMarketItems = {730: {'AWP | Lightning Strike (Factory New)': {value: 420.42}}};
            LoungeUser.userSettings.useCachedPriceList = '1';
            var item = new Item($(itemHtml));
            item.getMarketPrice(true);
            expect(item.marketPriced).to.equal(true);
            expect(item.marketValue).to.be.a('number');
        });

        it('should have market price appended without weapon quality to the item element', function() {
            window.storageMarketItems = {730: {'AWP | Lightning Strike (Factory New)': {value: 420.42}}};
            LoungeUser.userSettings.displayCsgoWeaponQuality = '0';
            var item = new Item($(itemHtml));
            item.getMarketPrice(true);
            var rarityText = $(item.item).find('.rarity').text();
            expect(rarityText).to.not.contain(item.weaponQualityAbbrevation);
            expect(rarityText).to.contain(item.marketValue);
        });

        it('should get market price from already marketed item list', function() {
            LoungeUser.userSettings.useCachedPriceList = '0';
            window.marketedItems = {'AWP | Lightning Strike (Factory New)': 13.77};

            var item = new Item($(itemHtml));
            item.getMarketPrice();
            expect(item).to.have.property('marketPriced');
            expect(item).to.have.property('marketValue');
            expect(item.marketValue).to.be.a('number');

        });

        //it('should get market price from Steam API', function() {
        //    LoungeUser.userSettings.useCachedPriceList = '0';
        //
        //    var item = new Item($(itemHtml));
        //    item.getMarketPrice();
        //    expect(item).to.have.property('marketPriced');
        //    expect(item).to.have.property('marketValue');
        //
        //});
    });
});