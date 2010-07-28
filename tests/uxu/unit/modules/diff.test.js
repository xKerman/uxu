var topDir = baseURL+'../../../../';
var Diff;

function setUp()
{
    var ns = {};
    utils.include(topDir+'modules/diff.js', ns);
    Diff = ns.Diff;
}

function testIsInterested()
{
    assertFalse(Diff.isInterested());
    assertFalse(Diff.isInterested(""));
    assertFalse(Diff.isInterested(" a\n" +
                                  " b\n" +
                                  " c"));
    assertFalse(Diff.isInterested("- abc\n" +
                                  "+ abc"));
    assertTrue(Diff.isInterested("- a\n" +
                                 "+ b\n" +
                                 "+ c"));
    assertTrue(Diff.isInterested("- abc\n" +
                                 "+ abc\n" +
                                 "  xyz"));
    assertTrue(Diff.isInterested("- abc def ghi xyz\n" +
                                 "?     ^^^\n" +
                                 "+ abc DEF ghi xyz\n" +
                                 "?     ^^^"));
    assertTrue(Diff.isInterested("  a\n" +
                                 "- abc def ghi xyz\n" +
                                 "?     ^^^\n" +
                                 "+ abc DEF ghi xyz\n" +
                                 "?     ^^^"));

    assertFalse(Diff.isInterested("- 23456789" +
                                  "1123456789" +
                                  "2123456789" +
                                  "3123456789" +
                                  "4123456789" +
                                  "5123456789" +
                                  "6123456789" +
                                  "712345678\n" +
                                  "+ XXXXXXXX" +
                                  "1123456789" +
                                  "2123456789" +
                                  "3123456789" +
                                  "4123456789" +
                                  "5123456789" +
                                  "6123456789" +
                                  "712345678"));
    assertTrue(Diff.isInterested("- 23456789" +
                                 "1123456789" +
                                 "2123456789" +
                                 "3123456789" +
                                 "4123456789" +
                                 "5123456789" +
                                 "6123456789" +
                                 "7123456789\n" +
                                 "+ XXXXXXXX" +
                                 "1123456789" +
                                 "2123456789" +
                                 "3123456789" +
                                 "4123456789" +
                                 "5123456789" +
                                 "6123456789" +
                                 "7123456789"));
}

function testReadableEmpty()
{
    assertEquals("", Diff.readable("", ""));
    assertEquals("", Diff.readable("", "", true));
}

function testNeedFold()
{
    assertFalse(Diff.needFold());
    assertFalse(Diff.needFold(""));
    assertFalse(Diff.needFold("0123456789" +
                              "1123456789" +
                              "2123456789" +
                              "3123456789" +
                              "4123456789" +
                              "5123456789" +
                              "6123456789" +
                              "7123456789"));

    assertFalse(Diff.needFold("- 23456789" +
                              "1123456789" +
                              "2123456789" +
                              "3123456789" +
                              "4123456789" +
                              "5123456789" +
                              "6123456789" +
                              "712345678"));
    assertFalse(Diff.needFold("+ 23456789" +
                              "1123456789" +
                              "2123456789" +
                              "3123456789" +
                              "4123456789" +
                              "5123456789" +
                              "6123456789" +
                              "712345678"));

    assertTrue(Diff.needFold("- 23456789" +
                             "1123456789" +
                             "2123456789" +
                             "3123456789" +
                             "4123456789" +
                             "5123456789" +
                             "6123456789" +
                             "7123456789"));
    assertTrue(Diff.needFold("+ 23456789" +
                             "1123456789" +
                             "2123456789" +
                             "3123456789" +
                             "4123456789" +
                             "5123456789" +
                             "6123456789" +
                             "7123456789"));

    assertTrue(Diff.needFold("\n" +
                             "+ 23456789" +
                             "1123456789" +
                             "2123456789" +
                             "3123456789" +
                             "4123456789" +
                             "5123456789" +
                             "6123456789" +
                             "7123456789" +
                             "\n"));
}

function testFold()
{
    assertEquals("0123456789" +
                 "1123456789" +
                 "2123456789" +
                 "3123456789" +
                 "4123456789" +
                 "5123456789" +
                 "6123456789" +
                 "71234567\n" +
                 "89" +
                 "8123456789",
                 Diff._fold("0123456789" +
                            "1123456789" +
                            "2123456789" +
                            "3123456789" +
                            "4123456789" +
                            "5123456789" +
                            "6123456789" +
                            "7123456789" +
                            "8123456789"));
}

function testFoldedReadable()
{
    assertEquals("- 0123456789" +
                 "1123456789" +
                 "2123456789" +
                 "3123456789" +
                 "4123456789" +
                 "5123456789" +
                 "6123456789" +
                 "71234567\n" +
                 "?  ^^^^^^^^^\n" +
                 "+ 0000000000" +
                 "1123456789" +
                 "2123456789" +
                 "3123456789" +
                 "4123456789" +
                 "5123456789" +
                 "6123456789" +
                 "71234567\n" +
                 "?  ^^^^^^^^^\n" +
                 "  89" +
                 "8123456789",
                 Diff.foldedReadable("0123456789" +
                                     "1123456789" +
                                     "2123456789" +
                                     "3123456789" +
                                     "4123456789" +
                                     "5123456789" +
                                     "6123456789" +
                                     "7123456789" +
                                     "8123456789",

                                     "0000000000" +
                                     "1123456789" +
                                     "2123456789" +
                                     "3123456789" +
                                     "4123456789" +
                                     "5123456789" +
                                     "6123456789" +
                                     "7123456789" +
                                     "8123456789"));
    assertEquals('<span class="block replaced">'+
                   '<span class="line replaced includes-both-modification">'+
                     '0'+
                     '<span class="phrase replaced">'+
                     '<span class="phrase deleted">123456789</span>'+
                     '<span class="phrase inserted">000000000</span>'+
                     '</span>'+
                     '1123456789'+
                     '2123456789'+
                     '3123456789'+
                     '4123456789'+
                     '5123456789'+
                     '6123456789'+
                     '71234567'+
                   '</span>'+
                 '</span>'+
                 '<span class="block equal">'+
                   '<span class="line equal">'+
                     '89'+
                     '8123456789'+
                   '</span>'+
                 '</span>',
                 Diff.foldedReadable("0123456789" +
                                     "1123456789" +
                                     "2123456789" +
                                     "3123456789" +
                                     "4123456789" +
                                     "5123456789" +
                                     "6123456789" +
                                     "7123456789" +
                                     "8123456789",

                                     "0000000000" +
                                     "1123456789" +
                                     "2123456789" +
                                     "3123456789" +
                                     "4123456789" +
                                     "5123456789" +
                                     "6123456789" +
                                     "7123456789" +
                                     "8123456789",

                                     true));
}