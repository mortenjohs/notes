const fs = require('fs');
const child_process = require("child_process");
const path = require('path');

function startCommand()
{
	switch (process.platform)
	{ 
		case 'darwin' : return 'open';
		case 'win32' : return 'start';
		case 'win64' : return 'start';
		default : return 'xdg-open';
	}
}

function listNotes()
{
	var files = getFiles();
	for (var i = 0; i < files.length; i++)
	{
		var file = files[i];
		if (filter && file.toLowerCase().indexOf(filter.toLowerCase()) === -1)
		{
			continue;
		}
		console.log("[" + i + "] " + files[i].replace(settings.encrypted_extension, ""));
	}	
}

function getFileName(index)
{
	var files = getFiles();
	return path.join(settings.local_folder, files[index]);	
}

function loadJson(path)
{
	var data = fs.readFileSync(path, 'utf8');
	return JSON.parse(data);	
}

function loadSettings()
{
  return loadJson('../core/settings.json');
}

function loadLg()
{
	return loadJson('../core/lg.json');
}

function importFile(file)
{
	var newFile = path.join(settings.local_folder, path.basename(file).replace(settings.default_temp_extension, settings.encrypted_extension));
	encrypt(file, newFile);
}

function translate(key)
{
	return lg[key][settings.language];
}

function getFiles(folder)
{
	folder = folder || settings.local_folder;
	var files = [];
	var content = fs.readdirSync(folder, { withFileTypes: true });
	content.forEach(file => 
	{
		if (file.isFile() && path.extname(file.name) === settings.encrypted_extension)
		{
			files.push(path.join(folder, file.name).replace(settings.local_folder, ''));
		}
		if (file.isDirectory())
		{
			files = files.concat(getFiles(path.join(folder, file.name)));
		}
	});
	return files;
}

function usage()
{
	var usages = [];
	for (var i in commands)
	{
		var usage = commands[i].usage;
		if (usage)
		{
			usages.push(usage);
		}
	}
	console.log(usages.join(" | "));
}

function editFile(fileName)
{
	execCommand(settings.editor, [fileName]);
}

function encrypt(input, output)
{
	execCommand("gpg", settings.gpg_options.concat(["-o", output, "-e", input]));
}

function execCommand(command, args)
{
	child_process.spawnSync(command, args,
	{
    	stdio: 'inherit'
	});
}

function home()
{
	listNotes();
	usage();
}

function decrypt(input, output)
{
	output = output || tempFileName;
	execCommand("gpg", settings.gpg_options.concat(["-o", output,"-d", input]));
}

var commands = 
{
	mer:
	{
		exec: function()
		{
			console.log("il et fou!");
		}
	},
	
	filter:
	{
		usage: "notes filter <word>",
		exec: function(word)
		{
			filter = word;
		}
	},

	ed: 
	{
		usage: "notes ed <index>",
		exec: function(index)
		{
			var fileName = getFileName(index);
			decrypt(fileName, tempFileName);
			editFile(tempFileName);
			encrypt(tempFileName, fileName);
		}
	},
	
	cat:
	{
		usage: "notes cat <index>",
		exec: function(index)
		{
			var fileName = getFileName(index);

			decrypt(fileName, tempFileName);
			var data = fs.readFileSync(tempFileName, 'utf8');
			
			console.log(fileName + ":");
			console.log(data);
		}
	},

	add:
	{
		usage: "notes add <title>",
		exec: function(arg)
		{
			editFile(tempFileName);
			encrypt(tempFileName, path.join(settings.local_folder, arg + ".asc"));
		}
	},

	sync:
	{
		usage: "notes sync",
		exec: function()
		{
			execCommand(settings.sync_command, settings.sync_command_options);
		}
	},

	settings:
	{
		usage: "notes settings",
		exec: function()
		{
			editFile('../core/settings.json');
			settings = loadSettings();
		}
	},

	rm:
	{
		usage: "notes rm <index>",
		exec: function(index)
		{
			fs.unlinkSync(getFileName(index));
		}
	},

	import:
	{
		usage: "notes import <path>",
		exec: function(file)
		{
			if (fs.statSync(file).isDirectory())
			{
				var files = fs.readdirSync(file);
				for (var i in files)
				{
					importFile(path.join(file, files[i]));
				}
			}
			else
			{
				importFile(file);
			}
		}
	},
	
	export:
	{
		usage: "notes export <dest>",
		exec: function(dest)
		{
			var files = getFiles();
			for (var index in files)
			{
				var fileName = path.join(settings.local_folder, files[index]);
				var outputFileName = path.join(dest, files[index].replace(settings.encrypted_extension, settings.default_temp_extension));
				decrypt(fileName, outputFileName);
			}
		}
	},
	
	explore:
	{
		exec: function()
		{
			child_process.exec(startCommand() + ' ' + settings.local_folder);
		}
	},
	
	view:
	{
		usage: "notes view <index>",
		exec: function(index)
		{
			var htmlFileName = tempFileName + '.html';
			var fileName = getFileName(index);
			decrypt(fileName, tempFileName);
			execCommand('pandoc', [tempFileName, '-o', htmlFileName]);
			
			child_process.exec(startCommand() + ' ' + htmlFileName);
			
			// to improve!
			setTimeout(function()
			{
				fs.unlinkSync(htmlFileName);
			}, 5000);
		}
	}
}

var settings = loadSettings();
var lg = loadLg();
var tempFileName = '.note' + settings.default_temp_extension;
var filter = "";

if (settings.auto_sync) commands.sync.exec();

var command = process.argv[2];
if (commands[command])
{
	commands[command].exec(process.argv[3]);
}
else if (command)
{
	console.log(command + translate("unknown command"));
}

home();

if (fs.existsSync(tempFileName))
{
	fs.unlinkSync(tempFileName);
	if (settings.auto_sync) commands.sync.exec();
}
